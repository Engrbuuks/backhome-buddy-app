"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/db";

/** Simple per-instance rate limiter for auth endpoints. Good against casual
 *  brute force in dev/single-instance; for serverless scale, swap for a
 *  shared store (e.g. Upstash Redis) at the payments/live step. */
const attempts = new Map<string, { n: number; t: number }>();
function rateLimited(key: string, max = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.t > windowMs) { attempts.set(key, { n: 1, t: now }); return false; }
  a.n += 1;
  return a.n > max;
}

const HOME_FOR: Record<UserRole, string> = {
  client: "/client/dashboard",
  buddy: "/buddy/dashboard",
  admin: "/admin/dashboard",
};

/** Sign in, then route to the portal matching the user's role. */
export async function signIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (rateLimited(`signin:${email}`)) return { error: "Too many attempts — wait a minute and try again." };
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Could not establish a session. Try again." };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  const role = (profile?.role as UserRole) || "client";
  redirect(HOME_FOR[role]);
}

/** Client self-signup. A DB trigger creates the profile row (role defaults to client). */
export async function signUpClient(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").slice(0, 120);
  if (rateLimited(`signup:${email}`, 5)) return { error: "Too many attempts — wait a minute and try again." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const supabase = createClient();

  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };
  redirect("/client/dashboard");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Buddy application: creates the account, flips role, opens a buddy profile
 *  under review, and alerts admins. Email confirmation still applies. */
export async function signUpBuddy(_prev: unknown, formData: FormData) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { notifyAdmins } = await import("@/lib/notifications/notify");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").slice(0, 120).trim();
  const phone = String(formData.get("phone") || "").slice(0, 32).trim();
  const city = String(formData.get("city") || "").slice(0, 80).trim();
  const skills = String(formData.get("skills") || "").slice(0, 300)
    .split(",").map((s) => s.trim()).filter(Boolean);

  if (rateLimited(`apply:${email}`, 5)) return { error: "Too many attempts — wait a minute and try again." };
  if (!fullName || !email || !phone || !city) return { error: "Fill in your name, email, phone and city." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };
  const userId = data.user?.id;
  if (!userId) return { error: "Could not create your account — try again." };

  const db = createAdminClient();
  await db.from("profiles").update({ role: "buddy", phone, full_name: fullName }).eq("id", userId);
  await db.from("buddy_profiles").insert({ id: userId, vetting: "under_review", skills });
  await db.from("audit_log").insert({ actor_id: userId, action: "buddy_application", detail: { city, skills } });
  await notifyAdmins("New buddy application", `${fullName} (${city}) applied — review and vet.`, "/admin/buddies");
  return { error: "", done: true };
}
