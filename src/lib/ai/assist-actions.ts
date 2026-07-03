"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { aiGenerate, type AiImage } from "@/lib/support/ai";

/** Admin AI assists. Principle: AI DRAFTS, the human APPROVES.
 *  Nothing here is ever sent to a client automatically. */

async function admin() {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p : null;
}

async function loadRequest(requestId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("requests")
    .select("*, service_types(name), regions(name, zone), quote_items(label, amount_ngn), proofs(id, kind, note, file_url, created_at), profiles!requests_client_id_fkey(full_name)")
    .eq("id", requestId)
    .maybeSingle();
  return data;
}

/** 1. Draft the client-facing completion report from proofs + buddy notes. */
export async function aiDraftReport(requestId: string) {
  if (!(await admin())) return { error: "Not authorized." };
  const req = await loadRequest(requestId);
  if (!req) return { error: "Request not found." };
  const notes = (req.proofs ?? []).filter((p: any) => p.note).map((p: any) => `- ${p.note}`).join("\n") || "(no notes)";
  const kinds = (req.proofs ?? []).map((p: any) => p.kind).join(", ") || "none";
  const system = `You draft professional task-completion reports for Backhome Buddy, a Nigerian diaspora concierge service whose product is verifiable proof. Write clean, factual, client-facing prose. Structure: SUMMARY (2-3 sentences), FINDINGS / WHAT WAS DONE (organized points covering the client's checklist where evidence exists), EVIDENCE PROVIDED (what media accompanies this report), NOTES & OBSERVATIONS. Report findings only — no recommendations, no decisions made for the client, no promises. If something on the checklist is not evidenced in the buddy notes, list it under "Not covered" rather than inventing it. Plain text, no markdown symbols.`;
  const user = `Service: ${req.service_types?.name ?? "Custom task"}
Task title: ${req.title}
Client name: ${req.profiles?.full_name ?? "Client"}
Location: ${req.regions?.name ?? req.requested_state ?? "—"}
Client's request description: ${req.description ?? "—"}
Client's checklist (success criteria): ${req.expectations ?? "(none given)"}
Buddy field notes: 
${notes}
Proof media submitted: ${kinds}

Draft the completion report.`;
  return aiGenerate(system, user);
}

/** Save the human-approved report; the client sees it on their request. */
export async function saveReport(requestId: string, report: string) {
  const p = await admin();
  if (!p) return { error: "Not authorized." };
  const text = report.trim().slice(0, 20000);
  const db = createAdminClient();
  const { error } = await db.from("requests").update({ report: text || null }).eq("id", requestId);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "save_report", target_id: requestId, detail: { chars: text.length } });
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/client/requests/${requestId}`);
  return { error: "" };
}

/** 2. Triage a new request: what's missing + drafted clarifying questions. */
export async function aiTriageRequest(requestId: string) {
  if (!(await admin())) return { error: "Not authorized." };
  const req = await loadRequest(requestId);
  if (!req) return { error: "Request not found." };
  const system = `You triage incoming task requests for Backhome Buddy (diaspora errands in Nigeria). Output two short sections in plain text:
MISSING / UNCLEAR: the specific facts needed before this task can be quoted and executed (addresses, dates, contact persons, document references, access arrangements). Only list what is genuinely missing for THIS service type.
MESSAGE TO CLIENT: a warm, concise message (ready to send) asking for those details, addressed to the client by first name. No prices, no timelines.`;
  const user = `Service: ${req.service_types?.name ?? "Custom task"}
Urgency: ${req.urgency ?? "standard"}
Title: ${req.title}
Description: ${req.description ?? "—"}
Client checklist: ${req.expectations ?? "(none)"}
Location: ${req.regions?.name ?? req.requested_state ?? "—"}
Recipient on ground: ${req.recipient_name ?? "—"} / ${req.recipient_phone ?? "—"} / ${req.recipient_address ?? "—"}
Client first name: ${(req.profiles?.full_name ?? "there").split(" ")[0]}`;
  return aiGenerate(system, user);
}

/** 3. Vision check: do the proof images cover the checklist? */
export async function aiCheckProofs(requestId: string) {
  if (!(await admin())) return { error: "Not authorized." };
  const req = await loadRequest(requestId);
  if (!req) return { error: "Request not found." };
  const photoProofs = (req.proofs ?? []).filter((p: any) => p.file_url && p.kind !== "video");
  if (!photoProofs.length) return { error: "No proof images on this request yet." };
  const db = createAdminClient();
  const proofPaths = photoProofs.map((p: any) => p.file_url);
  const urlMap = new Map<string, string>();
  const { r2Configured, presignDownloadMany } = await import("@/lib/storage/r2");
  if (r2Configured()) {
    const r2 = await presignDownloadMany("proofs", proofPaths, 600);
    r2.forEach((v, k) => urlMap.set(k, v));
  }
  const missing = (proofPaths.filter((p: string) => !urlMap.has(p)) as string[]);
  if (missing.length) {
    const { data: sup } = await db.storage.from("proofs").createSignedUrls(missing as string[], 600);
    (sup ?? []).forEach((s: any) => { if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl); });
  }
  const signed = proofPaths.map((p: string) => ({ path: p, signedUrl: urlMap.get(p) }));
  const images: AiImage[] = [];
  for (const s of (signed ?? []).slice(0, 6)) {
    if (!s.signedUrl) continue;
    try {
      const res = await fetch(s.signedUrl);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 4_000_000) continue; // skip oversized files
      images.push({ mimeType: res.headers.get("content-type") || "image/jpeg", base64: buf.toString("base64") });
    } catch { /* skip unreadable file */ }
  }
  if (!images.length) return { error: "Could not load proof images for review." };
  const system = `You are a quality gate for Backhome Buddy. Review the attached proof photos against the task and the client's checklist. Output plain text sections:
COVERED: checklist/task elements clearly evidenced by the photos (say which photo).
GAPS: elements NOT evidenced, or photos that are blurry, dark, cropped, or unconvincing — be specific so the buddy can re-shoot while still on site.
VERDICT: one line — "Ready for client review" or "Send buddy back for: …".
Judge only what is visible. Do not invent content.`;
  const user = `Service: ${req.service_types?.name ?? "Custom task"}
Task: ${req.title}
Description: ${req.description ?? "—"}
Client checklist: ${req.expectations ?? "(none — judge against the description)"}
Buddy notes: ${(req.proofs ?? []).filter((p: any) => p.note).map((p: any) => p.note).join(" | ") || "(none)"}
${images.length} photo(s) attached.`;
  return aiGenerate(system, user, images);
}

/** 4. Suggest quote line items as JSON for the Quote Builder. */
export async function aiSuggestQuoteItems(requestId: string) {
  if (!(await admin())) return { error: "Not authorized." };
  const req = await loadRequest(requestId);
  if (!req) return { error: "Request not found." };
  const db = createAdminClient();
  const { data: urgentRow } = await db.from("app_settings").select("value").eq("key", "pricing_urgent_surcharge_pct").maybeSingle();
  const urgentPct = Number((urgentRow?.value as any)?.pct) || 40;
  const base = Number(req.service_types?.base_price_ngn ?? 0);
  const system = `You itemize quotes for Backhome Buddy tasks in Nigeria. Respond ONLY with a JSON array, no markdown fences, no commentary. Each element: {"label": string, "amount_ngn": number}. Rules: first line is the service base fee at the given base price; add realistic Nigerian cost lines implied by the description (transport/logistics, official/agency fees, printing/notarization, second visit, recipient coordination) with conservative round NGN amounts; if urgency is urgent, include {"label":"Urgent priority surcharge","amount_ngn": <base * ${urgentPct}/100 rounded>}. 2 to 6 lines total. Amounts are estimates the admin will adjust.`;
  const user = `Service: ${req.service_types?.name ?? "Custom task"} (base ₦${base})
Urgency: ${req.urgency ?? "standard"}
Zone: ${req.regions?.zone ?? "—"} (${req.regions?.name ?? req.requested_state ?? "—"})
Title: ${req.title}
Description: ${req.description ?? "—"}
Checklist: ${req.expectations ?? "(none)"}`;
  const out = await aiGenerate(system, user);
  if (out.error) return { error: out.error };
  try {
    const clean = (out.text || "").replace(/```json|```/g, "").trim();
    const arr = JSON.parse(clean);
    if (!Array.isArray(arr)) throw new Error("not array");
    const items = arr
      .filter((x: any) => x && typeof x.label === "string" && Number.isFinite(Number(x.amount_ngn)))
      .slice(0, 8)
      .map((x: any) => ({ label: String(x.label).slice(0, 120), amount_ngn: Math.max(0, Math.round(Number(x.amount_ngn))) }));
    if (!items.length) throw new Error("empty");
    return { items, error: "" };
  } catch {
    return { error: "AI response wasn't usable — try again." };
  }
}

/** 5. Screen a buddy application: summary + flags as vetting notes (never a decision). */
export async function aiScreenBuddy(buddyId: string) {
  if (!(await admin())) return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: b } = await db
    .from("buddy_profiles")
    .select("*, profiles!buddy_profiles_id_fkey(full_name, email, phone)")
    .eq("id", buddyId)
    .maybeSingle();
  if (!b) return { error: "Buddy not found." };
  const gs = Array.isArray(b.guarantors) ? b.guarantors : [];
  const system = `You screen field-agent applications for Backhome Buddy. You NEVER decide or recommend approval/rejection — vetting decisions belong to humans and the checklist. Output plain text:
SUMMARY: 2-3 sentences on who this applicant is.
STRENGTHS: relevant capability signals.
CHECK CLOSELY: inconsistencies or things to probe at interview (age vs claimed experience, address vs coverage area, vague answers, guarantor quality, declared records) — phrased as questions to ask, not judgments.
Do not speculate beyond the data given.`;
  const user = `Name: ${b.profiles?.full_name ?? "—"}
DOB: ${b.date_of_birth ?? "—"} | City/State/LGA: ${b.city ?? "—"} / ${b.state ?? "—"} / ${b.lga ?? "—"}
Address: ${b.address ?? "—"} | Coverage: ${b.coverage_areas ?? "—"}
Occupation: ${b.occupation ?? "—"} | Availability: ${b.availability ?? "—"}
Experience: ${b.experience ?? "—"}
Skills: ${(b.skills ?? []).join(", ") || "—"}
Smartphone: ${b.has_smartphone ? "yes" : "no"} | Can drive: ${b.can_drive ? "yes" : "no"} | License: ${b.has_drivers_license ? "yes" : "no"}
Criminal record declared: ${b.criminal_record === true ? `YES — ${b.criminal_record_details ?? ""}` : b.criminal_record === false ? "No" : "—"}
Guarantors: ${gs.length ? gs.map((g: any) => `${g.name} (${g.occupation}, ${g.relationship})`).join("; ") : "(not yet provided)"}
Next of kin: ${(b.next_of_kin as any)?.name ?? "—"}
Bank account name: ${b.bank_account_name ?? "—"} (legal name: ${b.profiles?.full_name ?? "—"})`;
  return aiGenerate(system, user);
}

/** Send an (admin-edited) message to the request's client. Delivers an in-app
 *  notification + email, linking them to their request. Used to send the triage
 *  questions or any custom message. The admin edits/approves before sending. */
export async function sendMessageToClient(requestId: string, message: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const text = String(message || "").trim();
  if (text.length < 2) return { error: "Message is empty." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, client_id, title").eq("id", requestId).maybeSingle();
  if (!req?.client_id) return { error: "This request has no client on file." };

  // Post into the request's message thread so follow-ups live in one place.
  await db.from("request_messages").insert({ request_id: requestId, sender: "staff", sender_id: p.id, content: text });

  const { notify } = await import("@/lib/notifications/notify");
  await notify(req.client_id, `New message about "${req.title}"`, text.slice(0, 160), `/client/requests/${requestId}`);
  await db.from("audit_log").insert({ actor_id: p.id, action: "message_client", target_id: requestId, detail: { chars: text.length } });
  return { error: "" };
}
