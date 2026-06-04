"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { canTransition } from "@/lib/money/stateMachine";
import { notify, notifyAdmins } from "@/lib/notifications/notify";

async function myAssignedRequest(requestId: string, buddyId: string) {
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status, assigned_buddy_id").eq("id", requestId).single();
  if (!req || req.assigned_buddy_id !== buddyId) return null;
  return req;
}
async function transition(db: any, req: any, to: string, actorId: string, note: string) {
  await db.from("requests").update({ status: to, updated_at: new Date().toISOString() }).eq("id", req.id);
  await db.from("request_timeline").insert({ request_id: req.id, from_status: req.status, to_status: to, actor_id: actorId, note });
}

export async function startTask(requestId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return { error: "Not authorized." };
  const req = await myAssignedRequest(requestId, p.id);
  if (!req) return { error: "Task not found." };
  if (!canTransition(req.status, "in_progress")) return { error: `Cannot start from "${req.status}".` };
  const db = createAdminClient();
  await transition(db, req, "in_progress", p.id, "Buddy started the task");
  const { data: rOwn } = await db.from("requests").select("client_id, title").eq("id", requestId).single();
  if (rOwn) await notify(rOwn.client_id, "Work has started", `Your buddy started "${rOwn.title}".`, `/client/requests/${requestId}`);
  revalidatePath(`/buddy/tasks/${requestId}`); revalidatePath("/buddy/dashboard");
  return { error: "" };
}

export async function submitProof(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return { error: "Not authorized." };
  const requestId = String(formData.get("request_id") || "");
  const note = String(formData.get("note") || "").trim();
  if (!note) return { error: "Write your report — what was done, what you found." };
  const req = await myAssignedRequest(requestId, p.id);
  if (!req) return { error: "Task not found." };
  if (!canTransition(req.status, "proof_ready")) return { error: `Cannot submit proof from "${req.status}".` };
  const db = createAdminClient();
  const rows: any[] = [{ request_id: requestId, buddy_id: p.id, kind: "report", note }];
  try {
    const files = JSON.parse(String(formData.get("files") || "[]")) as { path: string; kind: string }[];
    for (const f of files.slice(0, 12)) {
      if (f?.path && ["photo", "video"].includes(f.kind)) {
        rows.push({ request_id: requestId, buddy_id: p.id, kind: f.kind, file_url: f.path });
      }
    }
  } catch {}
  const { error: prErr } = await db.from("proofs").insert(rows);
  if (prErr) return { error: prErr.message };
  await transition(db, req, "proof_ready", p.id, "Proof submitted — awaiting review");
  await notifyAdmins("Proof submitted", "A buddy submitted proof — review it.", `/admin/requests/${requestId}`);
  revalidatePath(`/buddy/tasks/${requestId}`); revalidatePath("/buddy/dashboard");
  return { error: "", saved: true };
}

export async function getMyTask(id: string) {
  const supabase = createClient(); // RLS scopes to assigned buddy
  const { data } = await supabase
    .from("requests")
    .select("*, service_types(name), proofs(id, kind, note, created_at)")
    .eq("id", id).single();
  return data ?? null;
}
