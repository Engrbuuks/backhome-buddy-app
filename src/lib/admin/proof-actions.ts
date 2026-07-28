"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

/** Delete a single proof: removes the file from R2 (and Supabase, for legacy)
 *  AND the database row, so it disappears cleanly from every dashboard with no
 *  trace. Admin only. */
export async function deleteProof(proofId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorised." };
  if (!proofId) return { error: "Missing proof." };

  const db = createAdminClient();
  const { data: proof } = await db.from("proofs").select("id, file_url, request_id").eq("id", proofId).maybeSingle();
  if (!proof) return { error: "Proof not found." };

  // Remove the stored file first (best-effort — proceed even if already gone).
  if (proof.file_url) {
    try {
      const { r2Configured, deleteObject } = await import("@/lib/storage/r2");
      if (r2Configured()) { await deleteObject("proofs", proof.file_url); }
      else { await db.storage.from("proofs").remove([proof.file_url]); }
    } catch { /* file may already be deleted from Cloudflare — continue */ }
    // Also attempt Supabase removal for any legacy file.
    try { await db.storage.from("proofs").remove([proof.file_url]); } catch {}
  }

  const { error } = await db.from("proofs").delete().eq("id", proofId);
  if (error) return { error: error.message };

  await db.from("audit_log").insert({ actor_id: p.id, action: "delete_proof", target_id: proof.request_id, detail: { proof_id: proofId } });
  revalidatePath(`/admin/requests/${proof.request_id}`);
  return { error: "" };
}

/** Reconcile: remove DB rows whose files no longer exist in storage. Called to
 *  clean up after files were deleted directly in the Cloudflare dashboard, so
 *  orphaned references disappear from all dashboards. Admin only. */
export async function purgeMissingProofs(requestId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorised.", removed: 0 };
  const db = createAdminClient();
  const { data: proofs } = await db.from("proofs").select("id, file_url").eq("request_id", requestId).not("file_url", "is", null);
  if (!proofs?.length) return { error: "", removed: 0 };

  const { r2Configured, presignDownload } = await import("@/lib/storage/r2");
  const missing: string[] = [];
  for (const pr of proofs as any[]) {
    let exists = false;
    try {
      if (r2Configured()) {
        // HEAD-style check: try to presign+fetch; a 404 means the object is gone.
        const url = await presignDownload("proofs", pr.file_url, 60);
        const res = await fetch(url, { method: "HEAD" });
        exists = res.ok;
      } else {
        exists = true; // skip check when R2 not configured
      }
    } catch { exists = false; }
    if (!exists) missing.push(pr.id);
  }
  if (missing.length) {
    await db.from("proofs").delete().in("id", missing);
    await db.from("audit_log").insert({ actor_id: p.id, action: "purge_missing_proofs", target_id: requestId, detail: { count: missing.length } });
    revalidatePath(`/admin/requests/${requestId}`);
  }
  return { error: "", removed: missing.length };
}

/** Delete an entire request/task: removes all its proof files from storage,
 *  then deletes the request row (DB cascade removes proofs, payments, messages,
 *  etc.). Admin only. Irreversible. */
export async function deleteRequest(requestId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorised." };
  if (!requestId) return { error: "Missing request." };
  const db = createAdminClient();

  // 1) Remove proof files from storage first (before rows are gone).
  const { data: proofs } = await db.from("proofs").select("file_url").eq("request_id", requestId).not("file_url", "is", null);
  if (proofs?.length) {
    const keys = proofs.map((x: any) => x.file_url).filter(Boolean);
    try {
      const { r2Configured, deleteObject } = await import("@/lib/storage/r2");
      if (r2Configured()) { for (const k of keys) { try { await deleteObject("proofs", k); } catch {} } }
    } catch {}
    try { await db.storage.from("proofs").remove(keys); } catch {}
  }

  // 2) Explicitly delete every child that references this request, in an order
  //    that never violates a foreign key. We don't rely solely on ON DELETE
  //    CASCADE, because if any cascade migration wasn't applied the delete would
  //    fail with an FK error. Each table is best-effort: a missing table is
  //    simply skipped. This makes deletion robust across migration states.
  const childTables = [
    "request_milestones", "request_messages", "request_timeline",
    "quote_items", "extra_charges", "expectations", "recipients",
    "disputes", "payouts", "refunds", "payments", "proofs",
  ];
  for (const t of childTables) {
    try { await db.from(t).delete().eq("request_id", requestId); } catch { /* table may not exist */ }
  }
  // Ledger rows: detach rather than delete, to preserve financial history.
  try { await db.from("transactions").update({ request_id: null }).eq("request_id", requestId); } catch {}
  // Remove in-app notifications that point at this request (link-based, no FK).
  try { await db.from("notifications").delete().like("link", `%/requests/${requestId}%`); } catch {}

  // 3) Delete the request itself.
  const { error } = await db.from("requests").delete().eq("id", requestId);
  if (error) return { error: `Could not delete: ${error.message}` };

  await db.from("audit_log").insert({ actor_id: p.id, action: "delete_request", target_id: requestId, detail: {} });
  revalidatePath("/admin/requests"); revalidatePath("/admin");
  return { error: "" };
}

/** Delete several requests at once (for clearing test data). Admin only. */
export async function deleteRequestsBulk(requestIds: string[]): Promise<{ deleted: number; failed: number; error: string }> {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { deleted: 0, failed: 0, error: "Not authorised." };
  let deleted = 0, failed = 0;
  for (const id of requestIds.slice(0, 200)) {
    const r = await deleteRequest(id);
    if (r.error) failed++; else deleted++;
  }
  revalidatePath("/admin/requests");
  return { deleted, failed, error: "" };
}

/** Delete a user (client or buddy): removes their auth account, which cascades
 *  to their profile and (for buddies) buddy_profile. Their requests are removed
 *  too. Admin only. Cannot delete yourself or another admin. Irreversible. */
export async function deleteUser(userId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorised." };
  if (!userId) return { error: "Missing user." };
  if (userId === p.id) return { error: "You can't delete your own account." };
  const db = createAdminClient();

  const { data: target } = await db.from("profiles").select("id, role").eq("id", userId).maybeSingle();
  if (!target) return { error: "User not found." };
  if (target.role === "admin") return { error: "Admins can't be deleted from here (safety). Change their role first." };

  // Remove storage owned by this user: proof files (as buddy) + vetting files.
  try {
    const { r2Configured, deleteObject } = await import("@/lib/storage/r2");
    // Proof files from their tasks
    const { data: proofs } = await db.from("proofs").select("file_url").eq("buddy_id", userId).not("file_url", "is", null);
    // Requests they own (client) — delete those requests' proof files + requests
    const { data: reqs } = await db.from("requests").select("id").eq("client_id", userId);
    if (r2Configured()) {
      for (const pr of (proofs ?? []) as any[]) { try { await deleteObject("proofs", pr.file_url); } catch {} }
    }
    // Vetting docs
    const { data: bp } = await db.from("buddy_profiles").select("id_doc_path, utility_bill_path, pcc_path, passport_photo_path, nin_slip_path, cv_path").eq("id", userId).maybeSingle();
    if (r2Configured() && bp) {
      for (const key of Object.values(bp)) { if (key) { try { await deleteObject("vetting", key as string); } catch {} } }
    }
    // Delete their owned requests explicitly (cascade removes children + proofs rows)
    for (const r of (reqs ?? []) as any[]) { await db.from("requests").delete().eq("id", r.id); }
  } catch {}

  // Delete the auth user → cascades to profiles → buddy_profiles.
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    // Fallback: if auth delete fails, at least remove the profile row.
    const { error: pErr } = await db.from("profiles").delete().eq("id", userId);
    if (pErr) return { error: `Could not delete user: ${error.message}` };
  }

  await db.from("audit_log").insert({ actor_id: p.id, action: "delete_user", target_id: userId, detail: { role: target.role } });
  revalidatePath("/admin/buddies"); revalidatePath("/admin/users"); revalidatePath("/admin");
  return { error: "" };
}
