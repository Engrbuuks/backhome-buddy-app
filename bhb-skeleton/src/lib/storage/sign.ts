import { createAdminClient } from "@/lib/supabase/admin";

/** Attach short-lived signed URLs to proofs that have a stored file path.
 *  Call ONLY after app-level access to the request is already verified. */
export async function signProofUrls<T extends { file_url?: string | null }>(proofs: T[]): Promise<(T & { signedUrl?: string })[]> {
  const paths = (proofs ?? []).map((p) => p.file_url).filter(Boolean) as string[];
  if (paths.length === 0) return proofs ?? [];
  const db = createAdminClient();
  const { data } = await db.storage.from("proofs").createSignedUrls(paths, 3600);
  const urlOf = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return (proofs ?? []).map((p) => ({ ...p, signedUrl: (p.file_url ? urlOf.get(p.file_url) : undefined) ?? undefined }));
}
