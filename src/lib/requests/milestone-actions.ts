"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

async function admin() {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p : null;
}

// ---------- Service-type templates ----------
export async function listServiceMilestones(serviceTypeId: string) {
  const db = createAdminClient();
  const { data } = await db.from("service_milestones").select("*").eq("service_type_id", serviceTypeId).order("sort_order");
  return data ?? [];
}

export async function saveServiceMilestones(serviceTypeId: string, milestones: Array<{ title: string; hint?: string }>) {
  if (!(await admin())) return { error: "Not authorized." };
  const db = createAdminClient();
  await db.from("service_milestones").delete().eq("service_type_id", serviceTypeId);
  const rows = milestones
    .filter((m) => m.title.trim())
    .map((m, i) => ({ service_type_id: serviceTypeId, title: m.title.trim().slice(0, 160), hint: (m.hint || "").trim().slice(0, 400) || null, sort_order: i }));
  if (rows.length) {
    const { error } = await db.from("service_milestones").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath("/admin/services");
  return { error: "" };
}

// ---------- Per-request milestones ----------
export async function getRequestMilestones(requestId: string) {
  const db = createAdminClient();
  const { data } = await db.from("request_milestones").select("*").eq("request_id", requestId).order("sort_order");
  return data ?? [];
}

/** Copy a service type's template milestones onto a request (once). Called at
 *  assignment; no-op if the request already has milestones. */
export async function seedRequestMilestones(requestId: string) {
  const db = createAdminClient();
  const { count } = await db.from("request_milestones").select("id", { count: "exact", head: true }).eq("request_id", requestId);
  if ((count ?? 0) > 0) return { error: "" };
  const { data: req } = await db.from("requests").select("service_type_id").eq("id", requestId).maybeSingle();
  if (!(req as any)?.service_type_id) return { error: "" };
  const { data: tmpl } = await db.from("service_milestones").select("title, hint, sort_order").eq("service_type_id", (req as any).service_type_id).order("sort_order");
  if (!tmpl?.length) return { error: "" };
  const rows = tmpl.map((t: any) => ({ request_id: requestId, title: t.title, hint: t.hint, sort_order: t.sort_order }));
  await db.from("request_milestones").insert(rows);
  return { error: "" };
}

/** Admin edits the per-request milestone list (tweak the template for this task). */
export async function saveRequestMilestones(requestId: string, milestones: Array<{ id?: string; title: string; hint?: string }>) {
  if (!(await admin())) return { error: "Not authorized." };
  const db = createAdminClient();
  // Simplest robust approach: replace the set, but keep any that are already done
  // by matching on id (so completion isn't wiped when admin edits wording).
  const { data: existing } = await db.from("request_milestones").select("id, done, note").eq("request_id", requestId);
  const doneById = new Map((existing ?? []).map((m: any) => [m.id, { done: m.done, note: m.note }]));
  await db.from("request_milestones").delete().eq("request_id", requestId);
  const rows = milestones
    .filter((m) => m.title.trim())
    .map((m, i) => {
      const keep = m.id ? doneById.get(m.id) : undefined;
      return {
        request_id: requestId, title: m.title.trim().slice(0, 160),
        hint: (m.hint || "").trim().slice(0, 400) || null, sort_order: i,
        done: keep?.done ?? false, note: keep?.note ?? null,
      };
    });
  if (rows.length) {
    const { error } = await db.from("request_milestones").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath(`/admin/requests/${requestId}`);
  return { error: "" };
}

/** Buddy marks a milestone complete by attaching a proof (photo/video) + note.
 *  The uploaded file path comes from the same R2 flow used for general proof. */
export async function completeMilestone(requestId: string, milestoneId: string, input: {
  note: string; filePath?: string; kind?: "photo" | "video";
  lat?: number; lng?: number; accuracy?: number; capturedAt?: string; method?: string;
}) {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not signed in." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, assigned_buddy_id").eq("id", requestId).maybeSingle();
  if (!req || (req as any).assigned_buddy_id !== p.id) return { error: "Not your task." };
  const note = (input.note || "").trim();
  if (!note) return { error: "Add a short note describing this milestone." };
  if (!input.filePath) return { error: "Attach a photo or video for this milestone." };

  const now = new Date().toISOString();
  // Insert the proof, linked to this milestone.
  const { error: prErr } = await db.from("proofs").insert({
    request_id: requestId, buddy_id: p.id, kind: input.kind === "video" ? "video" : "photo",
    file_url: input.filePath, note, milestone_id: milestoneId,
    captured_lat: typeof input.lat === "number" ? input.lat : null,
    captured_lng: typeof input.lng === "number" ? input.lng : null,
    captured_accuracy: typeof input.accuracy === "number" ? input.accuracy : null,
    captured_at: input.capturedAt || null,
    capture_method: input.method === "live" ? "live" : "upload",
    server_received_at: now,
  });
  if (prErr) return { error: prErr.message };

  await db.from("request_milestones").update({ done: true, note }).eq("id", milestoneId).eq("request_id", requestId);
  revalidatePath(`/buddy/tasks/${requestId}`);
  return { error: "" };
}
