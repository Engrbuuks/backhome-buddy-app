"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

async function admin() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  return p;
}
function normEmail(e?: string) { return (e || "").trim().toLowerCase(); }
function normPhone(p?: string) {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("234")) d = "0" + d.slice(3);
  return d.slice(-11);
}
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.backhomebuddy.ng";
const CALENDLY = process.env.CALENDLY_INTERVIEW_URL || "https://calendly.com/backhomebuddy/30min";

/* Status flow:
   new → invited_to_apply → applied → qualified → invited_to_interview
   (rejected can happen from any stage)
   NO auto-qualify: everyone must apply on the app, and YOU review each
   application and manually mark who qualifies for interview. Tier is only a
   hint shown on the card, never an automatic gate. */

export type RecruitInput = {
  full_name: string; email?: string; phone?: string; state?: string; city?: string;
  occupation?: string; availability?: string; coverage?: string; strengths?: string; tier?: string;
};

export async function importRecruits(rows: RecruitInput[]) {
  const p = await admin(); if (!p) return { error: "Not authorised.", added: 0, skipped: 0 };
  if (!Array.isArray(rows) || rows.length === 0) return { error: "No rows to import.", added: 0, skipped: 0 };
  const db = createAdminClient();
  let added = 0, skipped = 0;
  for (const r of rows) {
    const name = (r.full_name || "").trim();
    if (!name) { skipped++; continue; }
    const email = normEmail(r.email);
    const phone = normPhone(r.phone);
    if (email || phone) {
      const { data: existing } = await db.from("recruits").select("id")
        .or([email ? `email.eq.${email}` : "", phone ? `phone.eq.${phone}` : ""].filter(Boolean).join(","))
        .maybeSingle();
      if (existing) { skipped++; continue; }
    }
    const { error } = await db.from("recruits").insert({
      full_name: name, email: email || null, phone: phone || null,
      state: r.state?.trim() || null, city: r.city?.trim() || null,
      occupation: r.occupation?.trim() || null, availability: r.availability?.trim() || null,
      coverage: r.coverage?.trim() || null, strengths: r.strengths?.trim() || null,
      tier: (r.tier || "").trim().toUpperCase() || null,
      status: "new", created_by: p.id,
    });
    if (error) { skipped++; } else { added++; }
  }
  revalidatePath("/admin/recruitment");
  return { error: "", added, skipped };
}

/** STAGE 1: invite a recruit to fill the application form on the app (/apply). */
export async function sendApplyInvite(id: string) {
  const p = await admin(); if (!p) return { error: "Not authorised." };
  const db = createAdminClient();
  const { data: r } = await db.from("recruits").select("*").eq("id", id).maybeSingle();
  if (!r) return { error: "Recruit not found." };
  if (!r.email) return { error: "This recruit has no email address." };
  if (["applied", "qualified", "invited_to_interview"].includes(r.status)) return { error: "This recruit has already applied." };

  const first = (r.full_name || "").split(" ")[0] || "there";
  const subject = "You're shortlisted — complete your Backhome Buddy application";
  const body =
    `Hi ${first},\n\n` +
    `Thank you for your interest in becoming a Backhome Buddy. You've been shortlisted, and the next step is to complete your full application on our platform.\n\n` +
    `Backhome Buddies help Nigerians abroad get things done back home — welfare checks, property verification, errands — with real, verified photo and video proof. ` +
    `${r.state ? `Your coverage around ${r.city || r.state} is exactly the kind we need. ` : ""}\n\n` +
    `Please complete your application using the button below. Once we review it, we'll invite qualifying applicants to a short interview.`;

  const { sendBrandedEmail } = await import("@/lib/notifications/notify");
  await sendBrandedEmail(r.email, subject, body, `${APP_URL}/apply`);

  const { error } = await db.from("recruits").update({ status: "invited_to_apply", invited_to_apply_at: new Date().toISOString() }).eq("id", id).eq("status", "new");
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "invite_recruit_apply", target_id: id, detail: { email: r.email } });
  revalidatePath("/admin/recruitment");
  return { error: "" };
}

export async function sendAllApplyInvites() {
  const p = await admin(); if (!p) return { error: "Not authorised.", sent: 0 };
  const db = createAdminClient();
  const { data: list } = await db.from("recruits").select("id").eq("status", "new").not("email", "is", null);
  if (!list?.length) return { error: "", sent: 0 };
  let sent = 0;
  for (const r of list as any[]) { const res = await sendApplyInvite(r.id); if (!res.error) sent++; }
  return { error: "", sent };
}

/** Sync which recruits have registered on the app (auto-detect by email match
 *  against profiles/buddy_profiles). Marks matched recruits as 'applied'. */
export async function syncApplied() {
  const p = await admin(); if (!p) return { error: "Not authorised.", matched: 0 };
  const db = createAdminClient();
  const { data: recruits } = await db.from("recruits").select("id, email, status, tier").not("email", "is", null)
    .in("status", ["new", "invited_to_apply"]);
  if (!recruits?.length) return { error: "", matched: 0 };
  const emails = (recruits as any[]).map((r) => r.email);
  const { data: profs } = await db.from("profiles").select("email, role").in("email", emails);
  const applied = new Set((profs ?? []).map((x: any) => (x.email || "").toLowerCase()));
  let matched = 0;
  for (const r of recruits as any[]) {
    if (applied.has((r.email || "").toLowerCase())) {
      // Everyone who applies goes to 'applied' — YOU review their application
      // and decide who qualifies for interview. Tier is only a hint, not a gate.
      await db.from("recruits").update({ status: "applied", applied_at: new Date().toISOString() }).eq("id", r.id);
      matched++;
    }
  }
  if (matched) revalidatePath("/admin/recruitment");
  return { error: "", matched };
}

/** Manual override: mark applied / qualify for interview / reject / reset. */
export async function setRecruitStatus(id: string, status: "new" | "applied" | "qualified" | "rejected") {
  const p = await admin(); if (!p) return { error: "Not authorised." };
  const db = createAdminClient();
  const patch: any = { status };
  if (status === "applied" || status === "qualified") patch.applied_at = new Date().toISOString();
  const { error } = await db.from("recruits").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/recruitment");
  return { error: "" };
}

/** STAGE 2: send the Calendly interview invite — ONLY for 'qualified' recruits
 *  (who have applied AND meet criteria). Enforced server-side. */
export async function sendInterviewInvite(id: string) {
  const p = await admin(); if (!p) return { error: "Not authorised." };
  const db = createAdminClient();
  const { data: r } = await db.from("recruits").select("*").eq("id", id).maybeSingle();
  if (!r) return { error: "Recruit not found." };
  if (r.status !== "qualified") return { error: "Only applicants who qualify for interview can be invited." };
  if (!r.email) return { error: "This recruit has no email address." };

  const first = (r.full_name || "").split(" ")[0] || "there";
  const subject = "You're invited to interview — Backhome Buddy";
  const body =
    `Hi ${first},\n\n` +
    `Great news — after reviewing your application, we'd like to invite you to a short screening interview.\n\n` +
    `It's a quick chat to get to know you and walk you through how Backhome Buddy works. Please pick a time that suits you using the button below.`;

  const { sendBrandedEmail } = await import("@/lib/notifications/notify");
  await sendBrandedEmail(r.email, subject, body, CALENDLY);

  const { error } = await db.from("recruits").update({ status: "invited_to_interview", interview_invited_at: new Date().toISOString() }).eq("id", id).eq("status", "qualified");
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "invite_recruit_interview", target_id: id, detail: { email: r.email } });
  revalidatePath("/admin/recruitment");
  return { error: "" };
}

export async function sendAllInterviewInvites() {
  const p = await admin(); if (!p) return { error: "Not authorised.", sent: 0 };
  const db = createAdminClient();
  const { data: list } = await db.from("recruits").select("id").eq("status", "qualified");
  if (!list?.length) return { error: "", sent: 0 };
  let sent = 0;
  for (const r of list as any[]) { const res = await sendInterviewInvite(r.id); if (!res.error) sent++; }
  return { error: "", sent };
}

export async function listRecruits() {
  const p = await admin(); if (!p) return [];
  const db = createAdminClient();
  const { data } = await db.from("recruits").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

export async function deleteRecruit(id: string) {
  const p = await admin(); if (!p) return { error: "Not authorised." };
  const db = createAdminClient();
  const { error } = await db.from("recruits").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/recruitment");
  return { error: "" };
}

/** For an applied recruit, find their buddy application (by email match) so the
 *  admin can review the full details before qualifying them for interview.
 *  Returns the buddy_profile id (to link to admin buddy management) if found. */
export async function getRecruitApplication(recruitId: string) {
  const p = await admin(); if (!p) return { error: "Not authorised.", buddyId: null as string | null };
  const db = createAdminClient();
  const { data: r } = await db.from("recruits").select("email").eq("id", recruitId).maybeSingle();
  if (!r?.email) return { error: "", buddyId: null };
  const { data: prof } = await db.from("profiles").select("id, role").eq("email", r.email).maybeSingle();
  if (!prof || prof.role !== "buddy") return { error: "", buddyId: null };
  return { error: "", buddyId: prof.id as string };
}
