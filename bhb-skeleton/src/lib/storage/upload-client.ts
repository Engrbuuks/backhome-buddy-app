"use client";

/** Browser helper: upload a file to R2 via a server-issued presigned URL.
 *  Returns the stored object key (saved as file path in the DB). */
export async function uploadToR2(bucket: "proofs" | "vetting", file: Blob, opts: { ext: string; contentType: string; scope?: string }): Promise<{ key: string }> {
  const res = await fetch("/api/storage/presign-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bucket, ext: opts.ext, contentType: opts.contentType, scope: opts.scope }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Could not prepare upload.");
  }
  const { url, key } = await res.json();
  const put = await fetch(url, { method: "PUT", headers: { "content-type": opts.contentType }, body: file });
  if (!put.ok) throw new Error("Upload failed. Please try again.");
  return { key };
}
