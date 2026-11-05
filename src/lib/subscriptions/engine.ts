/**
 * Monthly retainers: raising each month's task without anybody asking.
 *
 * SECURITY: no "use server" here, deliberately. `runDueSubscriptions` bills
 * people and creates work, and it takes no caller identity at all. Exposed as
 * an action it would be a public endpoint that generates invoices. It is
 * reached only from the cron route, which checks CRON_SECRET, and from an
 * admin guarded wrapper in ./actions.ts.
 *
 * WHY RETAINERS MATTER MORE THAN THEY LOOK
 *
 * Before this, nothing in the business recurred. Every task needed a fresh
 * decision to buy, a fresh quote, a fresh assignment and a fresh payment: four
 * acts of friction for every unit of revenue, forever.
 *
 * A retainer removes three of the four. The price was agreed once, so there is
 * no quote. The task raises itself, so there is no decision. Only the payment
 * remains, and that becomes a habit rather than a purchase.
 *
 * It also fixes the real supply problem, which was never demand. A buddy
 * holding eight monthly retainers in Ibadan has a reason to stay available and
 * answer offers. One off work gives them no reason to wait around.
 */
import { createAdminClient } from "@/lib/supabase/admin";

if (typeof window !== "undefined") {
  throw new Error("subscriptions/engine is server-only and must never reach the browser.");
}

/** Day 29, 30 and 31 do not exist every month, so a retainer on one of them
 *  would silently skip February. Clamped at creation and again here. */
export function clampDay(day: unknown): number {
  const d = Math.trunc(Number(day));
  if (!Number.isFinite(d)) return 1;
  return Math.min(28, Math.max(1, d));
}

/** The next occurrence of `day` strictly after `from`, as YYYY-MM-DD. */
export function nextRunDate(from: Date, day: number): string {
  const d = clampDay(day);
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  // This month's occurrence if it is still ahead of us, otherwise next month's.
  const thisMonth = new Date(Date.UTC(y, m, d));
  const target = thisMonth > from ? thisMonth : new Date(Date.UTC(y, m + 1, d));
  return target.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The month a retainer run bills for, as YYYY-MM.
 *
 * Stored on the request and made unique per subscription, which is what makes
 * double billing impossible. Deliberately the month rather than the day: a run
 * at 23:59 and another at 00:01 are the same billing month and must collide,
 * where a per day guard would let both through.
 */
export function billingPeriod(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export type RunReport = {
  due: number;
  raised: number;
  skipped: { id: string; title: string; reason: string }[];
};

/**
 * Raise this month's task for every retainer that is due.
 *
 * Deliberately conservative about doing it twice. The request is created
 * FIRST, and the subscription's schedule is only advanced once that insert
 * has succeeded, so a crash between the two leaves the retainer due rather
 * than silently skipped. A partial unique index in migration 0045 refuses a
 * second request for the same subscription on the same day, which is the real
 * guard: a cron that fires twice, or an admin pressing the manual button
 * beside it, cannot bill anybody twice.
 */
export async function runDueSubscriptions(limit = 200): Promise<RunReport> {
  const db = createAdminClient();
  const report: RunReport = { due: 0, raised: 0, skipped: [] };

  const { data: due, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .lte("next_run_on", today())
    .order("next_run_on")
    .limit(limit);

  if (error || !due?.length) return report;
  report.due = due.length;

  for (const sub of due) {
    try {
      const { data: req, error: insErr } = await db.from("requests").insert({
        client_id: sub.client_id,
        service_type_id: sub.service_type_id,
        region_id: sub.region_id,
        subscription_id: sub.id,
        title: sub.title,
        description: sub.description,
        recipient_name: sub.recipient_name,
        recipient_phone: sub.recipient_phone,
        recipient_address: sub.recipient_address,
        urgency: "standard",
        display_currency: "USD",
        // Already priced. This is the whole point: a retainer never waits for
        // a quote, because the price was agreed when it was set up.
        client_price_ngn: sub.monthly_price_ngn,
        service_revenue_ngn: sub.monthly_price_ngn,
        priced_automatically: true,
        billing_period: billingPeriod(),
        status: "awaiting_pay",
      }).select("id").single();

      if (insErr) {
        const dup = /duplicate|unique/i.test(insErr.message);
        report.skipped.push({
          id: sub.id,
          title: sub.title,
          reason: dup ? `Already billed for ${billingPeriod()}.` : insErr.message,
        });
        // A duplicate still means this month is handled, so move the schedule
        // on. Any other error leaves it due so the next run tries again.
        if (dup) await advance(db, sub);
        continue;
      }

      await db.from("quote_items").insert({
        request_id: req.id,
        label: "Monthly retainer",
        amount_ngn: sub.monthly_price_ngn,
        item_type: "service",
      });

      await db.from("request_timeline").insert({
        request_id: req.id,
        from_status: "submitted",
        to_status: "awaiting_pay",
        actor_id: null,
        note: "Raised automatically from a monthly retainer, already priced",
      });

      await advance(db, sub);
      report.raised++;

      const { notify, notifyAdmins } = await import("@/lib/notifications/notify");
      await notify(
        sub.client_id,
        "This month's visit is scheduled",
        `"${sub.title}" has been raised for this month. The amount is already agreed, so there is nothing to approve — just the transfer.`,
        `/client/requests/${req.id}`,
      );
      await notifyAdmins(
        "Retainer task raised",
        `"${sub.title}" was raised from a monthly retainer and is awaiting the client's transfer.`,
        `/admin/requests/${req.id}`,
      );
    } catch (e) {
      report.skipped.push({
        id: sub.id,
        title: sub.title,
        reason: e instanceof Error ? e.message : "Could not raise this month's task.",
      });
    }
  }

  return report;
}

async function advance(db: any, sub: any) {
  await db.from("subscriptions").update({
    last_run_on: today(),
    next_run_on: nextRunDate(new Date(), sub.day_of_month),
    runs_count: Number(sub.runs_count ?? 0) + 1,
  }).eq("id", sub.id);
}
