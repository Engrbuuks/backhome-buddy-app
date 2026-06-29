import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * SERVICE-ROLE client. Bypasses Row-Level Security entirely.
 *
 * ⚠️  Use ONLY in trusted server-side code that enforces the rules itself:
 *     payment/payout/refund logic, request state-machine transitions, ledger
 *     writes. NEVER import this into a client component or expose its key.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
