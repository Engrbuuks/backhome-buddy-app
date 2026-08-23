"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { canTransition } from "@/lib/money/stateMachine";
import { notify, notifyAdmins } from "@/lib/notifications/notify";

/** Client confirms completion. proof_approved → completed (payout becomes eligible). */
export async function confirmCompletion(requestId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "client") return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status, client_id").eq("id", requestId).single();
  if (!req || req.client_id !== p.id) return { error: "Request not found." };
  if (!canTransition(req.status, "completed")) return { error: `Cannot confirm from "${req.status}".` };
  await db.from("requests").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", req.id);
  await db.from("request_timeline").insert({ request_id: req.id, from_status: req.status, to_status: "completed", actor_id: p.id, note: "Client confirmed completion" });
  await db.from("audit_log").insert({ actor_id: p.id, action: "confirm_completion", target_id: req.id });
  const { data: r4 } = await db.from("requests").select("assigned_buddy_id, title").eq("id", req.id).single();
  if (r4?.assigned_buddy_id) await notify(r4.assigned_buddy_id, "Client confirmed completion", "Your payout is now eligible for release.", `/buddy/tasks/${req.id}`, "client_confirmed");
  await notifyAdmins("Payout eligible", `"${r4?.title ?? "A task"}" is client-confirmed — release the payout.`, "/admin/payouts");
  revalidatePath(`/client/requests/${requestId}`);
  return { error: "" };
}
