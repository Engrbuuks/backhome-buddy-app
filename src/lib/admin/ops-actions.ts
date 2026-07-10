"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { VETTING_CHECKS } from "@/lib/admin/vetting-checks";

async function admin() {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p : null;
}

export async function listBuddies() {
  if (!(await admin())) return [];
  const db = createAdminClient();
  const { data } = await db.from("buddy_profiles")
    .select("id, vetting, skills, bank_name, bank_account_number, bank_account_name, created_at, city, date_of_birth, nin, address, state, lga, coverage_areas, occupation, experience, availability, education_level, course_of_study, year_of_graduation, school_attended, has_smartphone, can_drive, has_drivers_license, criminal_record, criminal_record_details, consent_background_checks, consent_data_processing, guarantors, next_of_kin, id_doc_type, id_doc_path, utility_bill_path, pcc_path, passport_photo_path, nin_slip_path, cv_path, vetting_checks, vetting_notes, nda_signed_at, nda_signed_name, nda_version, proof_test_score, comp_property, comp_welfare, comp_documents, comp_purchases, comp_communication, comp_reliability, competency_specialisms, competency_notes, approved_task_types, profiles!buddy_profiles_id_fkey(full_name, email, phone)")
    .order("created_at", { ascending: false });
  const buddies = data ?? [];
  // Short-lived signed URLs for vetting documents (admin-only view).
  const paths = buddies.flatMap((b: any) => [b.id_doc_path, b.utility_bill_path, b.pcc_path, b.passport_photo_path, b.nin_slip_path, b.cv_path]).filter(Boolean) as string[];
  if (paths.length) {
    const urlOf = new Map<string, string | undefined>();
    const { r2Configured, presignDownloadMany } = await import("@/lib/storage/r2");
    if (r2Configured()) {
      const r2 = await presignDownloadMany("vetting", paths, 3600);
      r2.forEach((v, k) => urlOf.set(k, v));
    }
    const missing = (paths.filter((p) => !urlOf.get(p)) as string[]);
    if (missing.length) {
      const { data: signed } = await db.storage.from("vetting").createSignedUrls(missing as string[], 3600);
      (signed ?? []).forEach((s: any) => { if (s.path && s.signedUrl) urlOf.set(s.path, s.signedUrl); });
    }
    for (const b of buddies as any[]) {
      b.id_doc_url = b.id_doc_path ? urlOf.get(b.id_doc_path) : undefined;
      b.utility_bill_url = b.utility_bill_path ? urlOf.get(b.utility_bill_path) : undefined;
      b.pcc_url = b.pcc_path ? urlOf.get(b.pcc_path) : undefined;
      b.passport_photo_url = b.passport_photo_path ? urlOf.get(b.passport_photo_path) : undefined;
      b.nin_slip_url = b.nin_slip_path ? urlOf.get(b.nin_slip_path) : undefined;
      b.cv_url = b.cv_path ? urlOf.get(b.cv_path) : undefined;
    }
  }
  return buddies;
}

export async function updateVettingCheck(buddyId: string, key: string, value: boolean) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  if (!VETTING_CHECKS.some(([k]) => k === key)) return { error: "Unknown check." };
  if (key === "nda_signed") return { error: "The NDA check is set automatically when the buddy signs it in their portal — it can't be ticked manually." };
  const db = createAdminClient();
  const { data: row } = await db.from("buddy_profiles").select("vetting_checks").eq("id", buddyId).maybeSingle();
  const checks = { ...(row?.vetting_checks ?? {}), [key]: value };
  const { error } = await db.from("buddy_profiles").update({ vetting_checks: checks }).eq("id", buddyId);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "vetting_check", target_id: buddyId, detail: { key, value } });
  revalidatePath("/admin/buddies");
  return { error: "" };
}

export async function saveVettingNotes(buddyId: string, notes: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { error } = await db.from("buddy_profiles").update({ vetting_notes: notes.slice(0, 4000) }).eq("id", buddyId);
  if (error) return { error: error.message };
  revalidatePath("/admin/buddies");
  return { error: "" };
}

export async function setBuddyVetting(buddyId: string, vetting: "approved" | "rejected" | "suspended" | "under_review") {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  if (vetting === "approved") {
    // Approval is the RESULT of completed checks, not a shortcut around them.
    const { data: row } = await db.from("buddy_profiles").select("vetting_checks").eq("id", buddyId).maybeSingle();
    const checks = (row?.vetting_checks ?? {}) as Record<string, boolean>;
    const missing = VETTING_CHECKS.filter(([k]) => !checks[k]).map(([, label]) => label);
    if (missing.length) return { error: `Cannot approve yet — outstanding checks: ${missing.join("; ")}.` };
  }
  const { error } = await db.from("buddy_profiles").update({ vetting }).eq("id", buddyId);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "set_buddy_vetting", target_id: buddyId, detail: { vetting } });
  revalidatePath("/admin/buddies");
  return { error: "" };
}

/** Buddies may exist only as profiles.role=buddy without a buddy_profiles row (manual role flip). Surface those too. */
export async function listBuddyProfilesMissing() {
  if (!(await admin())) return [];
  const db = createAdminClient();
  const { data: roles } = await db.from("profiles").select("id, full_name, email").eq("role", "buddy");
  const { data: bps } = await db.from("buddy_profiles").select("id");
  const have = new Set((bps ?? []).map((b) => b.id));
  return (roles ?? []).filter((r) => !have.has(r.id));
}

export async function createBuddyProfileRow(profileId: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { error } = await db.from("buddy_profiles").insert({ id: profileId, vetting: "under_review" });
  if (error) return { error: error.message };
  revalidatePath("/admin/buddies");
  return { error: "" };
}

export async function listLedger() {
  if (!(await admin())) return [];
  const db = createAdminClient(); // transactions is service-role-only by design
  const { data } = await db.from("transactions")
    .select("id, kind, amount_ngn, note, created_at, requests(title)")
    .order("created_at", { ascending: false }).limit(100);
  return data ?? [];
}

export async function listRequestsByStatus(statuses: string[]) {
  if (!(await admin())) return [];
  const db = createAdminClient();
  const { data } = await db.from("requests")
    .select("id, title, status, client_price_ngn, buddy_payout_ngn, created_at, profiles!requests_client_id_fkey(full_name)")
    .in("status", statuses).order("created_at", { ascending: false });
  return data ?? [];
}

/** Email a buddy a checklist of the selected documents/items, asking them to
 *  reply to the email with them. Replies route to the support inbox. */
export async function requestBuddyDocuments(buddyId: string, itemKeys: string[]) {
  const p = await admin(); if (!p) return { error: "Not authorised" };
  if (!itemKeys?.length) return { error: "Select at least one item to request." };

  const { REQUESTABLE_ITEMS } = await import("./request-documents");
  const { sendBrandedEmail, notifyInApp } = await import("@/lib/notifications/notify");
  const db = createAdminClient();

  const { data: buddy } = await db
    .from("buddy_profiles")
    .select("id, profiles!buddy_profiles_id_fkey(full_name, email)")
    .eq("id", buddyId).maybeSingle();
  const email = (buddy as any)?.profiles?.email;
  const name = (buddy as any)?.profiles?.full_name || "there";
  if (!email) return { error: "This buddy has no email on file." };

  const chosen = REQUESTABLE_ITEMS.filter(([k]) => itemKeys.includes(k));
  if (!chosen.length) return { error: "No valid items selected." };

  const support = process.env.SUPPORT_EMAIL || "support@backhomebuddy.ng";
  const listHtml = chosen.map(([, label]) => `<li style="margin:6px 0;">${label}</li>`).join("");
  const body =
    `Hi ${name},<br><br>` +
    `Thank you for applying to become a Backhome Buddy. To continue your verification, please log in to your portal and provide the following in your Verification page:` +
    `<ul style="padding-left:18px;margin:14px 0;">${listHtml}</ul>` +
    `Click the button below to open your Verification page and upload them securely. If anything is unclear, just reply to this email — we're happy to help.<br><br>` +
    `Thank you,<br>The Backhome Buddy Team`;

  // Link the buddy straight to their in-app verification/upload page.
  await sendBrandedEmail(email, "Action needed: upload your verification documents", body, "/buddy/vetting", support);
  await notifyInApp(buddyId, "Documents needed for verification",
    `Please upload: ${chosen.map(([, l]) => l.split(":")[0]).join(", ")}.`, "/buddy/vetting");

  await db.from("audit_log").insert({ actor_id: p.id, action: "request_documents", target_id: buddyId, detail: { items: itemKeys } });
  return { error: "", sent: chosen.length, to: email };
}

/** Email a buddy asking them to complete an in-app onboarding ACTION (sign the
 *  NDA, or fill guarantor/next-of-kin details), with a button linking straight
 *  to their portal. Unlike requestBuddyDocuments (reply-to-email), these are
 *  actions the buddy completes inside the app. */
export async function requestBuddyAction(buddyId: string, action: "nda" | "guarantors") {
  const p = await admin(); if (!p) return { error: "Not authorised" };
  const { sendBrandedEmail } = await import("@/lib/notifications/notify");
  const { notifyInApp } = await import("@/lib/notifications/notify");
  const db = createAdminClient();

  const { data: buddy } = await db
    .from("buddy_profiles")
    .select("id, profiles!buddy_profiles_id_fkey(full_name, email)")
    .eq("id", buddyId).maybeSingle();
  const email = (buddy as any)?.profiles?.email;
  const name = (buddy as any)?.profiles?.full_name || "there";
  if (!email) return { error: "This buddy has no email on file." };

  const support = process.env.SUPPORT_EMAIL || "support@backhomebuddy.ng";
  let subject: string, body: string, link: string;

  if (action === "nda") {
    subject = "Action needed: sign your Backhome Buddy Confidentiality Agreement";
    link = "/buddy/vetting";
    body =
      `Hi ${name},<br><br>` +
      `Before your Backhome Buddy application can be approved, you need to read and sign our <strong>Confidentiality Agreement (NDA)</strong>. ` +
      `It only takes a minute — click the button below, log in, read the agreement, type your name and sign.<br><br>` +
      `Your account cannot be approved until this is signed.<br><br>Thank you,<br>The Backhome Buddy Team`;
  } else {
    subject = "Action needed: add your guarantor details";
    link = "/buddy/vetting";
    body =
      `Hi ${name},<br><br>` +
      `To continue your Backhome Buddy verification, please add your <strong>two guarantors</strong> and <strong>next of kin</strong> details. ` +
      `Click the button below, log in, and fill in the guarantor section of your verification page.<br><br>` +
      `Please provide, for each guarantor: full name, phone number, address, occupation, and their relationship to you.<br><br>` +
      `Thank you,<br>The Backhome Buddy Team`;
  }

  await sendBrandedEmail(email, subject, body, link, support);
  // Also drop an in-app notification for the buddy.
  await notifyInApp(buddyId, action === "nda" ? "Please sign your NDA" : "Please add guarantor details",
    action === "nda" ? "Sign the Confidentiality Agreement to continue your approval." : "Add your guarantors and next of kin to continue.",
    "/buddy/vetting");

  await db.from("audit_log").insert({ actor_id: p.id, action: "request_action", target_id: buddyId, detail: { action } });
  return { error: "", sent: true, to: email, action };
}
