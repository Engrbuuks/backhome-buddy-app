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
// Tier A/B pre-fill as 'qualified'; C and unknown start as 'new'.
function statusForTier(tier?: string) {
  const t = (tier || "").trim().toUpperCase();
  return t === "A" || t === "B" ? "qualified" : "new";
}

export type RecruitInput = {
  full_name: string; email?: string; phone?: string; state?: string; city?: string;
  occupation?: string; availability?: string; coverage?: string; strengths?: string; tier?: string;
};

/** Bulk import recruits (from CSV parse or pasted rows). Skips duplicates by
 *  email/phone. Tier A/B are pre-marked 'qualified'; others 'new'. */
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
    // Skip if a recruit with this email or phone already exists.
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
      status: statusForTier(r.tier), created_by: p.id,
    });
    if (error) { skipped++; } else { added++; }
  }
  revalidatePath("/admin/recruitment");
  return { error: "", added, skipped };
}

/** Change a recruit's qualification status (qualify / reject / reset). */
export async function setRecruitStatus(id: string, status: "new" | "qualified" | "rejected") {
  const p = await admin(); if (!p) return { error: "Not authorised." };
  const db = createAdminClient();
  const { error } = await db.from("recruits").update({ status }).eq("id", id).in("status", ["new", "qualified", "rejected"]);
  if (error) return { error: error.message };
  revalidatePath("/admin/recruitment");
  return { error: "" };
}

/** Send the Calendly interview invite — ONLY allowed for a 'qualified' recruit.
 *  Enforced on the server: an unqualified recruit can never be invited. */
export async function sendInterviewInvite(id: string) {
  const p = await admin(); if (!p) return { error: "Not authorised." };
  const db = createAdminClient();
  const { data: r } = await db.from("recruits").select("*").eq("id", id).maybeSingle();
  if (!r) return { error: "Recruit not found." };
  if (r.status !== "qualified") return { error: "Only qualified recruits can be invited to interview." };
  if (!r.email) return { error: "This recruit has no email address." };

  const calendly = process.env.CALENDLY_INTERVIEW_URL || "https://calendly.com/backhomebuddy/30min";
  if (!calendly) return { error: "Interview booking link is not configured (set CALENDLY_INTERVIEW_URL)." };

  const first = (r.full_name || "").split(" ")[0] || "there";
  const subject = "You're invited to interview — Backhome Buddy";
  const body =
    `Hi ${first},\n\n` +
    `Thank you for applying to become a Backhome Buddy. We were impressed by your application` +
    `${r.state ? ` and your coverage around ${r.city || r.state}` : ""}, and we'd like to invite you to a short screening interview.\n\n` +
    `Backhome Buddies help Nigerians abroad get things done back home — with real, verified proof. ` +
    `The interview is a quick chat to get to know you and explain how it works.\n\n` +
    `Please pick a time that suits you using the button below.`;

  const { sendBrandedEmail } = await import("@/lib/notifications/notify");
  await sendBrandedEmail(r.email, subject, body, calendly);

  const { error } = await db.from("recruits").update({ status: "invited", invited_at: new Date().toISOString() }).eq("id", id).eq("status", "qualified");
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "invite_recruit", target_id: id, detail: { email: r.email } });
  revalidatePath("/admin/recruitment");
  return { error: "" };
}

/** Send interview invites to ALL qualified (not-yet-invited) recruits at once. */
export async function sendAllQualifiedInvites() {
  const p = await admin(); if (!p) return { error: "Not authorised.", sent: 0 };
  const db = createAdminClient();
  const { data: list } = await db.from("recruits").select("id").eq("status", "qualified");
  if (!list?.length) return { error: "", sent: 0 };
  let sent = 0;
  for (const r of list as any[]) { const res = await sendInterviewInvite(r.id); if (!res.error) sent++; }
  revalidatePath("/admin/recruitment");
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
