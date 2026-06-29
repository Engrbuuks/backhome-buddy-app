import type { UserRole } from "@/types/db";
import { createClient } from "@/lib/supabase/server";

/**
 * Read the current user's profile (id + role) from their session.
 * Returns null if not logged in.
 */
export async function getCurrentProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .single();
  return profile ?? null;
}

/** Guard for server components / actions: require a logged-in user with one of the allowed roles. */
export async function requireRole(allowed: UserRole[]) {
  const profile = await getCurrentProfile();
  if (!profile || !allowed.includes(profile.role as UserRole)) {
    return { ok: false as const, profile: null };
  }
  return { ok: true as const, profile };
}
