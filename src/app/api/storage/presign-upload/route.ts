import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { presignUpload, type R2Bucket } from "@/lib/storage/r2";

export const runtime = "nodejs";

/** Issues a short-lived presigned PUT URL so the browser can upload a file
 *  directly to R2. Auth-gated: only signed-in users, and the object key is
 *  namespaced to their own id so they can't write into others' folders. */
export async function POST(req: NextRequest) {
  const p = await getCurrentProfile();
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const bucket = body.bucket as R2Bucket;
  const contentType = String(body.contentType || "application/octet-stream");
  const ext = String(body.ext || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "bin";
  const scope = String(body.scope || "").replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 64);

  if (bucket !== "proofs" && bucket !== "vetting") {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }
  // Buddies only for these buckets.
  if (p.role !== "buddy" && p.role !== "admin") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  // Key layout:
  //  proofs:  {taskId}/{uid}/{time}-{rand}.{ext}   (scope = taskId)
  //  vetting: {uid}/{time}-{rand}.{ext}            (uid folder — matches old RLS)
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now();
  const key = bucket === "proofs"
    ? `${scope || "misc"}/${p.id}/${stamp}-${rand}.${ext}`
    : `${p.id}/${stamp}-${rand}.${ext}`;

  try {
    const url = await presignUpload(bucket, key, contentType, 300);
    return NextResponse.json({ url, key });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Presign failed" }, { status: 500 });
  }
}
