/**
 * Milestone internals that cannot establish who is calling.
 *
 * SECURITY: no "use server" here, deliberately. `seedRequestMilestones` writes
 * rows onto a request identified only by an id it is handed, so it has no way
 * to know whether the caller is entitled to that request. Exported from a
 * "use server" file it was a public write endpoint: anyone could force a
 * milestone checklist onto any task. It is only ever called from code that has
 * already checked the caller (admin assignment, and the offer accept path,
 * which runs behind a SECURITY DEFINER function).
 *
 * Same split as src/lib/offers/engine.ts, for the same reason.
 */
import { createAdminClient } from "@/lib/supabase/admin";

if (typeof window !== "undefined") {
  throw new Error("requests/milestone-engine is server-only and must never reach the browser.");
}

/** Copy a service type's template milestones onto a request (once). Called at
 *  assignment; no-op if the request already has milestones. */
export async function seedRequestMilestones(requestId: string) {
  try {
    const db = createAdminClient();
    const { count, error: cErr } = await db
      .from("request_milestones")
      .select("id", { count: "exact", head: true })
      .eq("request_id", requestId);
    if (cErr) return { error: "" }; // table missing (migration not run) — skip quietly
    if ((count ?? 0) > 0) return { error: "" };
    const { data: req } = await db.from("requests").select("service_type_id").eq("id", requestId).maybeSingle();
    if (!(req as any)?.service_type_id) return { error: "" };
    const { data: tmpl } = await db
      .from("service_milestones")
      .select("title, hint, sort_order")
      .eq("service_type_id", (req as any).service_type_id)
      .order("sort_order");
    if (!tmpl?.length) return { error: "" };
    const rows = tmpl.map((t: any) => ({
      request_id: requestId, title: t.title, hint: t.hint, sort_order: t.sort_order,
    }));
    await db.from("request_milestones").insert(rows);
    return { error: "" };
  } catch {
    return { error: "" };
  }
}
