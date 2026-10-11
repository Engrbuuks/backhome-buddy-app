import { NextRequest, NextResponse } from "next/server";
import { expireAndCascade } from "@/lib/offers/engine";

/**
 * Offer expiry and cascade.
 *
 * Runs every 10 minutes (vercel.json), which is frequent enough that a 20
 * minute urgent window does not sit idle for long after it closes. Separate
 * from the daily auto-release job because the two run on very different clocks.
 *
 * Protected by CRON_SECRET, exactly as auto-release is.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await expireAndCascade();
  return NextResponse.json(result);
}
