import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { r2Configured, presignUpload, presignDownload, deleteObject } from "@/lib/storage/r2";

export const runtime = "nodejs";

/** Admin-only R2 diagnostic. Open in a browser (while logged in as admin):
 *   /api/storage/selftest            → reports which env vars are visible
 *   /api/storage/selftest?live=1     → actually writes + reads + deletes a tiny
 *                                       test object in each bucket, proving the
 *                                       full round-trip works. No real files.
 */
export async function GET(req: Request) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") {
    return NextResponse.json({ error: "Admin only. Log in as admin first." }, { status: 403 });
  }

  const report: Record<string, unknown> = {
    R2_ACCOUNT_ID_set: Boolean(process.env.R2_ACCOUNT_ID),
    R2_ACCESS_KEY_ID_set: Boolean(process.env.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY_set: Boolean(process.env.R2_SECRET_ACCESS_KEY),
    R2_BUCKET_PROOFS: process.env.R2_BUCKET_PROOFS || null,
    R2_BUCKET_VETTING: process.env.R2_BUCKET_VETTING || null,
    r2Configured: r2Configured(),
    hint: "All *_set must be true and both bucket names present. Add ?live=1 to run a real read/write test.",
  };

  const runLive = new URL(req.url).searchParams.get("live") === "1";
  if (runLive && r2Configured()) {
    for (const bucket of ["proofs", "vetting"] as const) {
      const key = `selftest/${Date.now()}-check.txt`;
      const result: Record<string, unknown> = {};
      try {
        // 1) presign an upload URL and PUT a tiny object
        const putUrl = await presignUpload(bucket, key, "text/plain", 120);
        const put = await fetch(putUrl, { method: "PUT", headers: { "content-type": "text/plain" }, body: "backhome-buddy r2 selftest" });
        result.upload_status = put.status;
        // 2) presign a download URL and GET it back
        const getUrl = await presignDownload(bucket, key, 120);
        const got = await fetch(getUrl);
        result.download_status = got.status;
        result.content_ok = (await got.text().catch(() => "")) === "backhome-buddy r2 selftest";
        // 3) clean up
        await deleteObject(bucket, key);
        result.cleaned_up = true;
        result.verdict = put.ok && got.ok && result.content_ok ? "✅ WORKING — write, read, delete all succeeded" : "⚠️ Partial — check statuses above";
      } catch (e) {
        result.verdict = "❌ FAILED";
        result.error = e instanceof Error ? e.message : "unknown";
      }
      report[`bucket_${bucket}`] = result;
    }
  } else if (runLive) {
    report.live = "Skipped — R2 not configured (env vars missing).";
  }

  return NextResponse.json(report);
}
