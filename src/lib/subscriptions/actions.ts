"use server";
/**
 * The guarded surface for monthly retainers.
 *
 * SECURITY: every export here is a public HTTP endpoint, so each establishes
 * who is calling before it touches anything. A client may only ever see, pause
 * or cancel their OWN retainer, and may never set its price: that is agreed
 * with you and written by an admin. `runDueSubscriptions` raises invoices and
 * takes no caller at all, so it stays in ./engine.ts and is reached only
 * through the admin wrapper below or the secret guarded cron route.
 */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { clampDay, nextRunDate } from "@/lib/subscriptions/engine";

function missingTable(error: any): boolean {
  const m = String(error?.message ?? error ?? "");
  return /subscriptions/i.test(m) && /(does not exist|not find|schema cache)/i.test(m);
}

/* ------------------------------------------------------------------ *
 * Client surface
 * ------------------------------------------------------------------ */

/** A client's own retainers. */
export async function listMySubscriptions() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "client") return { rows: [], migrationMissing: false };
  const db = createAdminClient();
  try {
    const { data, error } = await db
      .from("subscriptions")
      .select("*, service_types(name), regions(name)")
      .eq("client_id", p.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    if (error) return { rows: [], migrationMissing: missingTable(error) };
    return { rows: data ?? [], migrationMissing: false };
  } catch (e) {
    return { rows: [], migrationMissing: missingTable(e) };
  }
}

/**
 * A client pauses or cancels their own retainer.
 *
 * They cannot resume a cancelled one, and they cannot touch the price. Those
 * are deliberate: a cancellation should be a conversation with you, and a
 * price a client can edit is not a price.
 */
export async function setMySubscriptionStatus(subscriptionId: string, status: "active" | "paused" | "cancelled") {
  const p = await getCurrentProfile();
  if (!p || p.role !== "client") return { error: "Not authorized." };
  if (!["active", "paused", "cancelled"].includes(status)) return { error: "Unknown status." };

  const db = createAdminClient();
  const { data: sub } = await db
    .from("subscriptions").select("id, client_id, status, title, day_of_month").eq("id", subscriptionId).maybeSingle();
  if (!sub || sub.client_id !== p.id) return { error: "Retainer not found." };
  if (sub.status === "cancelled") return { error: "This retainer has already been cancelled." };

  const patch: Record<string, any> = { status };
  if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
  // Resuming picks up from the next occurrence rather than billing for the
  // months it was paused.
  if (status === "active") patch.next_run_on = nextRunDate(new Date(), sub.day_of_month);

  const { error } = await db.from("subscriptions").update(patch).eq("id", sub.id);
  if (error) return { error: error.message };

  const { notifyAdmins } = await import("@/lib/notifications/notify");
  await notifyAdmins(
    `Retainer ${status}`,
    `${p.full_name ?? "A client"} set "${sub.title}" to ${status}.`,
    "/admin/subscriptions",
  );

  revalidatePath("/client/subscriptions");
  return { error: "" };
}

/* ------------------------------------------------------------------ *
 * Admin surface
 * ------------------------------------------------------------------ */

export async function listSubscriptions() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { rows: [], migrationMissing: false, mrrNgn: 0 };
  const db = createAdminClient();
  try {
    const { data, error } = await db
      .from("subscriptions")
      .select("*, service_types(name), regions(name), profiles!subscriptions_client_id_fkey(full_name, email)")
      .order("status")
      .order("next_run_on")
      .limit(500);
    if (error) return { rows: [], migrationMissing: missingTable(error), mrrNgn: 0 };
    const rows = data ?? [];
    // The number that matters: revenue you can count on next month without
    // selling anything.
    const mrrNgn = rows
      .filter((r: any) => r.status === "active")
      .reduce((sum: number, r: any) => sum + Number(r.monthly_price_ngn ?? 0), 0);
    return { rows, migrationMissing: false, mrrNgn };
  } catch (e) {
    return { rows: [], migrationMissing: missingTable(e), mrrNgn: 0 };
  }
}

/** Admin sets a retainer up, having agreed the monthly price with the client. */
export async function createSubscription(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };

  const clientId = String(formData.get("client_id") || "");
  const title = String(formData.get("title") || "").trim().slice(0, 140);
  const price = Math.round(Number(formData.get("monthly_price_ngn") || 0));
  const day = clampDay(formData.get("day_of_month"));

  if (!clientId) return { error: "Pick the client." };
  if (!title) return { error: "Give the retainer a title, which becomes each month's task title." };
  if (!Number.isFinite(price) || price <= 0) return { error: "Set a monthly price above zero." };

  const db = createAdminClient();
  const { data: client } = await db.from("profiles").select("id, role, full_name").eq("id", clientId).maybeSingle();
  if (!client || client.role !== "client") return { error: "That is not a client account." };

  const row = {
    client_id: clientId,
    service_type_id: String(formData.get("service_type_id") || "") || null,
    region_id: String(formData.get("region_id") || "") || null,
    title,
    description: String(formData.get("description") || "").slice(0, 2000).trim() || null,
    recipient_name: String(formData.get("recipient_name") || "").slice(0, 120).trim() || null,
    recipient_phone: String(formData.get("recipient_phone") || "").slice(0, 32).trim() || null,
    recipient_address: String(formData.get("recipient_address") || "").slice(0, 300).trim() || null,
    monthly_price_ngn: price,
    day_of_month: day,
    status: "active",
    next_run_on: nextRunDate(new Date(), day),
  };

  const { data: made, error } = await db.from("subscriptions").insert(row).select("id, next_run_on").single();
  if (error) {
    if (missingTable(error)) return { error: "Retainers are not installed yet. Run migration 0045 in Supabase." };
    return { error: error.message };
  }

  await db.from("audit_log").insert({
    actor_id: p.id, action: "create_subscription", target_id: clientId,
    detail: { title, monthly_price_ngn: price, day_of_month: day },
  });

  const { notify } = await import("@/lib/notifications/notify");
  await notify(
    clientId,
    "Your monthly retainer is set up",
    `"${title}" will be raised every month on day ${day}. The price is agreed, so there is no quote to wait for each time. The first one is due ${made.next_run_on}.`,
    "/client/subscriptions",
  );

  revalidatePath("/admin/subscriptions");
  return { error: "", saved: true };
}

/** Admin changes the price, the day, or pauses a retainer. */
export async function updateSubscription(
  subscriptionId: string,
  patch: { monthly_price_ngn?: number; day_of_month?: number; status?: "active" | "paused" | "cancelled" },
) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const db = createAdminClient();

  const { data: sub } = await db.from("subscriptions").select("*").eq("id", subscriptionId).maybeSingle();
  if (!sub) return { error: "Retainer not found." };

  const next: Record<string, any> = {};
  if (patch.monthly_price_ngn != null) {
    const v = Math.round(Number(patch.monthly_price_ngn));
    if (!Number.isFinite(v) || v <= 0) return { error: "The monthly price must be above zero." };
    next.monthly_price_ngn = v;
  }
  if (patch.day_of_month != null) {
    next.day_of_month = clampDay(patch.day_of_month);
    next.next_run_on = nextRunDate(new Date(), next.day_of_month);
  }
  if (patch.status) {
    next.status = patch.status;
    if (patch.status === "cancelled") next.cancelled_at = new Date().toISOString();
    if (patch.status === "active") next.next_run_on = nextRunDate(new Date(), next.day_of_month ?? sub.day_of_month);
  }
  if (Object.keys(next).length === 0) return { error: "Nothing to change." };

  const { error } = await db.from("subscriptions").update(next).eq("id", sub.id);
  if (error) return { error: error.message };

  await db.from("audit_log").insert({
    actor_id: p.id, action: "update_subscription", target_id: sub.client_id,
    detail: { subscription_id: sub.id, ...next },
  });

  // A price change is the client's money, so they are told rather than finding
  // out from next month's invoice.
  if (next.monthly_price_ngn != null) {
    const { notify } = await import("@/lib/notifications/notify");
    await notify(
      sub.client_id,
      "Your retainer price has changed",
      `"${sub.title}" is now ₦${Number(next.monthly_price_ngn).toLocaleString("en-NG")} a month. Reply to this if that is not what you agreed.`,
      "/client/subscriptions",
    );
  }

  revalidatePath("/admin/subscriptions");
  revalidatePath("/client/subscriptions");
  return { error: "" };
}

/** Admin raises the due retainers now, without waiting for the overnight run. */
export async function runSubscriptionsNow() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  const { runDueSubscriptions } = await import("@/lib/subscriptions/engine");
  const report = await runDueSubscriptions();
  revalidatePath("/admin/subscriptions");
  return report;
}
