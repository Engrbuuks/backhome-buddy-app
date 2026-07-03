import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Cloudflare R2 storage (S3-compatible). Replaces Supabase Storage for proof
 *  and vetting files. Buckets stay PRIVATE — access is only ever via short-lived
 *  presigned URLs generated server-side after app-level authorization.
 *
 *  Env (Vercel):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_PROOFS (e.g. "bhb-proofs"), R2_BUCKET_VETTING (e.g. "bhb-vetting")
 */

export type R2Bucket = "proofs" | "vetting";

function client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 storage is not configured (missing R2_ACCOUNT_ID / keys).");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function bucketName(bucket: R2Bucket): string {
  const name = bucket === "proofs" ? process.env.R2_BUCKET_PROOFS : process.env.R2_BUCKET_VETTING;
  if (!name) throw new Error(`R2 bucket for "${bucket}" not configured.`);
  return name;
}

export function r2Configured(): boolean {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

/** A short-lived URL the browser can PUT a file to directly (keeps R2 keys server-side). */
export async function presignUpload(bucket: R2Bucket, key: string, contentType: string, expiresIn = 300): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucketName(bucket), Key: key, ContentType: contentType });
  return getSignedUrl(client(), cmd, { expiresIn });
}

/** A short-lived URL to VIEW/download a stored object. */
export async function presignDownload(bucket: R2Bucket, key: string, expiresIn = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucketName(bucket), Key: key });
  return getSignedUrl(client(), cmd, { expiresIn });
}

/** Presign many download URLs at once. Returns a map keyed by object key. */
export async function presignDownloadMany(bucket: R2Bucket, keys: string[], expiresIn = 3600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(keys.filter(Boolean))).map(async (k) => {
      try { out.set(k, await presignDownload(bucket, k, expiresIn)); } catch {}
    })
  );
  return out;
}

export async function deleteObject(bucket: R2Bucket, key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }));
}
