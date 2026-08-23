import { createAdminClient } from "@/lib/supabase/admin";
import { presignDownloadMany, r2Configured } from "@/lib/storage/r2";

/** Attach short-lived signed URLs to proofs that have a stored file path.
 *  Call ONLY after app-level access to the request is already verified.
 *  Files uploaded to R2 are keyed with an "r2:" convention is NOT used — instead
 *  we try R2 first (current) and fall back to Supabase for legacy paths. */
export async function signProofUrls<T extends { file_url?: string | null }>(proofs: T[]): Promise<(T & { signedUrl?: string })[]> {
  const paths = (proofs ?? []).map((p) => p.file_url).filter(Boolean) as string[];
  if (paths.length === 0) return proofs ?? [];

  const urlOf = new Map<string, string>();

  if (r2Configured()) {
    const r2 = await presignDownloadMany("proofs", paths, 3600);
    r2.forEach((v, k) => urlOf.set(k, v));
  }
  // Any paths R2 didn't resolve (legacy Supabase files) — sign via Supabase.
  const missing = (paths.filter((p) => !urlOf.has(p)) as string[]);
  if (missing.length > 0) {
    const db = createAdminClient();
    const { data } = await db.storage.from("proofs").createSignedUrls(missing as string[], 3600);
    (data ?? []).forEach((d: any) => { if (d.path && d.signedUrl) urlOf.set(d.path, d.signedUrl); });
  }

  return (proofs ?? []).map((p) => ({ ...p, signedUrl: (p.file_url ? urlOf.get(p.file_url) : undefined) ?? undefined }));
}
