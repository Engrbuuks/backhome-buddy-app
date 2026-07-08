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
