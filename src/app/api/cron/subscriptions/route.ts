import { NextRequest, NextResponse } from "next/server";
import { runDueSubscriptions } from "@/lib/subscriptions/engine";

/**
 * Daily cron (vercel.json). Protected by CRON_SECRET.
 *
 * Raises this month's task for every retainer that has come due. Daily rather
 * than monthly on purpose: a retainer set for day 14 is due on day 14, and a
 * single monthly cron would have to guess which day that is for everybody.
 * Running every morning and picking up whatever is due is simpler and survives
 * a missed day, because anything overdue is still due the next morning.
 *
 * Fails closed when the secret is unset, like the other two. If CRON_SECRET is
 * missing, every run returns 401 and no retainer is ever raised — the admin
 * dashboard names that as switched off so it cannot happen silently.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDueSubscriptions();
  return NextResponse.json(result);
}
