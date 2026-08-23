import { NextRequest, NextResponse } from "next/server";
import { runAutoRelease } from "@/lib/money/auto-release";

/** Daily cron (vercel.json). Protected by CRON_SECRET. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runAutoRelease();
  return NextResponse.json(result);
}
