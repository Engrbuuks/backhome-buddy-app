"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { locationByCode } from "@/lib/testimonials/locations";

async function admin() {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p : null;
}

/** Admin generates a one-time testimonial link for a named person. */
export async function createTestimonialInvite(_prev: unknown, formData: FormData) {
  const p = await admin();
  if (!p) return { error: "Not authorized." };
  const invitee_name = String(formData.get("invitee_name") || "").trim().slice(0, 120);
  const invitee_email = String(formData.get("invitee_email") || "").trim().slice(0, 200) || null;
  const note = String(formData.get("note") || "").trim().slice(0, 500) || null;
  if (!invitee_name) return { error: "Enter who this testimonial link is for." };

  const token = randomBytes(24).toString("base64url");
  const db = createAdminClient();
  const { error } = await db.from("testimonial_invites").insert({
    token, invitee_name, invitee_email, note, created_by: p.id,
  });
  if (error) return { error: error.message };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.backhomebuddy.ng";
  revalidatePath("/admin/testimonials");
  return { error: "", link: `${appUrl}/testimonial/${token}` };
}

/** Public: validate a token for the submission page (no auth). */
export async function getInviteByToken(token: string) {
  if (!token) return null;
  const db = createAdminClient();
  const { data } = await db.from("testimonial_invites").select("id, invitee_name, used").eq("token", token).maybeSingle();
  return data;
}

/** Public: submit a testimonial against a valid, unused one-time token. */
export async function submitTestimonial(input: {
  token: string; author_name: string; location_code: string; rating: number;
  body: string; media_url?: string; media_kind?: "photo" | "video";
}): Promise<{ error: string }> {
  const db = createAdminClient();
  const { data: invite } = await db.from("testimonial_invites").select("id, used").eq("token", input.token).maybeSingle();
  if (!invite) return { error: "This link is invalid." };
  if (invite.used) return { error: "This link has already been used." };

  const name = (input.author_name || "").trim().slice(0, 120);
  const body = (input.body || "").trim().slice(0, 2000);
  const rating = Math.min(5, Math.max(1, Number(input.rating) || 5));
  if (!name) return { error: "Please enter your name." };
  if (body.length < 10) return { error: "Please write a little more in your testimonial." };
  const loc = locationByCode(input.location_code);

  // Insert testimonial + mark the invite used, atomically enough for our needs.
  const { error: insErr } = await db.from("testimonials").insert({
    invite_id: invite.id, author_name: name,
    location_code: loc?.code || null, location_label: loc?.label || null,
    rating, body,
    media_url: input.media_url || null, media_kind: input.media_kind || null,
    status: "pending",
  });
  if (insErr) return { error: insErr.message };
  await db.from("testimonial_invites").update({ used: true, used_at: new Date().toISOString() }).eq("id", invite.id);

  // Notify admins there's a testimonial to review.
  try {
    const { notifyAdmins } = await import("@/lib/notifications/notify");
    await notifyAdmins("New testimonial to review", `${name} left a ${rating}-star testimonial.`, "/admin/testimonials");
  } catch {}
  return { error: "" };
}

/** Admin: list testimonials by status. */
export async function listTestimonials(status?: "pending" | "approved" | "rejected") {
  if (!(await admin())) return [];
  const db = createAdminClient();
  let q = db.from("testimonials").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return data ?? [];
}

/** Admin: approve or reject a testimonial. */
export async function moderateTestimonial(id: string, decision: "approved" | "rejected") {
  const p = await admin();
  if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const patch: any = { status: decision };
  if (decision === "approved") { patch.approved_at = new Date().toISOString(); patch.approved_by = p.id; }
  const { error } = await db.from("testimonials").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/testimonials");
  return { error: "" };
}

/** Admin: list generated invite links (to copy/track). */
export async function listInvites() {
  if (!(await admin())) return [];
  const db = createAdminClient();
  const { data } = await db.from("testimonial_invites").select("*").order("created_at", { ascending: false }).limit(100);
  return data ?? [];
}
