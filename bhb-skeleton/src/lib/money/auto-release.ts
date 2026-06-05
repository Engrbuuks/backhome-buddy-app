import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyAdmins } from "@/lib/notifications/notify";

/**
 * Auto-release: proof_approved requests where the client has been silent for N
 * days (admin-configurable) and no open dispute exists auto-confirm to
 * "completed" (payout eligible). Silence = consent, dispute = brake — the
 * escrow design agreed earlier. Run by cron or the admin's manual trigger.
 */
export async function runAutoRelease(): Promise<{ released: number }> {
  const db = createAdminClient();
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "auto_release_days").single();
  const days = Number((setting?.value as any)?.days ?? 7);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates } = await db.from("requests").select("id, title, client_id, assigned_buddy_id").eq("status", "proof_approved");
  let released = 0;
  for (const req of candidates ?? []) {
    // when did it become proof_approved?
    const { data: tl } = await db.from("request_timeline")
      .select("created_at").eq("request_id", req.id).eq("to_status", "proof_approved")
      .order("created_at", { ascending: false }).limit(1).single();
    if (!tl || tl.created_at > cutoff) continue;
    // any open dispute = brake
    const { data: disputes } = await db.from("disputes").select("id").eq("request_id", req.id).eq("status", "open").limit(1);
    if ((disputes ?? []).length) continue;

    await db.from("requests").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", req.id);
    await db.from("request_timeline").insert({ request_id: req.id, from_status: "proof_approved", to_status: "completed", note: `Auto-confirmed after ${days} days with no objection` });
    await db.from("audit_log").insert({ action: "auto_release", target_id: req.id, detail: { days } });
    await notify(req.client_id, "Completion auto-confirmed", `"${req.title}" was auto-confirmed after ${days} days. Raise an issue if something is wrong.`, `/client/requests/${req.id}`);
    if (req.assigned_buddy_id) await notify(req.assigned_buddy_id, "Client confirmation complete", "Your payout is now eligible for release.", `/buddy/tasks/${req.id}`);
    await notifyAdmins("Payout eligible (auto-release)", `"${req.title}" auto-confirmed — release the payout.`, "/admin/payouts");
    released++;
  }
  return { released };
}
