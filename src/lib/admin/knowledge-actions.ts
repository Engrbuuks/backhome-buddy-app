"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { DEFAULT_KNOWLEDGE, KNOWLEDGE_SETTING_KEY, getKnowledgeBase } from "@/lib/support/knowledge";

/** Admin → Knowledge Base. Stored in app_settings (service-role writes only). */

export async function getKnowledgeForAdmin() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  const text = await getKnowledgeBase();
  return { text, isDefault: text === DEFAULT_KNOWLEDGE };
}

export async function saveKnowledge(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const text = String(formData.get("text") || "").trim();
  if (!text) return { error: "Knowledge base cannot be empty. Use Reset to restore the default instead." };
  if (text.length > 20000) return { error: "Too long — keep it under 20,000 characters so replies stay fast." };
  const db = createAdminClient();
  const { error } = await db.from("app_settings").upsert({
    key: KNOWLEDGE_SETTING_KEY,
    value: { text },
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "update_knowledge_base", detail: { chars: text.length } });
  revalidatePath("/admin/knowledge");
  return { error: "", saved: true };
}

export async function resetKnowledge(_prev: unknown, _formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const db = createAdminClient();
  const { error } = await db.from("app_settings").delete().eq("key", KNOWLEDGE_SETTING_KEY);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "reset_knowledge_base", detail: {} });
  revalidatePath("/admin/knowledge");
  return { error: "", saved: true };
}

/** Pages on the marketing site to read when refreshing the knowledge base.
 *  Add or remove paths here as the website grows. */
const WEBSITE_URL = process.env.WEBSITE_URL || "https://backhomebuddy.ng";
const WEBSITE_PAGES = ["/", "/services", "/how-it-works", "/about", "/faq", "/pricing", "/contact"];

/** Strip HTML to readable text (lightweight — no external deps). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fetch the live website content and use AI to rewrite it into a clean knowledge
 *  base. Returns DRAFT text for the admin to review — does NOT auto-save, so a bad
 *  scrape can never silently corrupt the assistant's knowledge. */
export async function refreshKnowledgeFromWebsite() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };

  // 0. Try to discover real page URLs from the sitemap; fall back to guessed paths.
  let pages: string[] = WEBSITE_PAGES.map((path) => `${WEBSITE_URL}${path}`);
  try {
    const sm = await fetch(`${WEBSITE_URL}/sitemap.xml`, { headers: { "user-agent": "BackhomeBuddyBot/1.0" }, cache: "no-store" });
    if (sm.ok) {
      const xml = await sm.text();
      const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((m) => m[1].trim());
      // Prefer content pages; skip posts, tags, wp-admin, feeds, images.
      const content = locs.filter((u) => /backhomebuddy\.ng/i.test(u) && !/\/(wp-|tag|category|author|feed|\.jpg|\.png|\.pdf)/i.test(u));
      if (content.length >= 3) pages = content.slice(0, 12);
    }
  } catch { /* no sitemap — use guessed paths */ }

  // 1. Fetch each page, collect readable text.
  const chunks: string[] = [];
  let fetched = 0;
  for (const url of pages) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "BackhomeBuddyBot/1.0" }, cache: "no-store" });
      if (!res.ok) continue;
      const html = await res.text();
      const text = htmlToText(html);
      if (text.length > 100) { chunks.push(`--- PAGE: ${url.replace(WEBSITE_URL, "") || "/"} ---\n${text.slice(0, 6000)}`); fetched++; }
    } catch { /* skip unreachable page */ }
  }
  if (fetched === 0) return { error: `Couldn't read any pages from ${WEBSITE_URL}. Check the site is live and WEBSITE_URL is correct.` };

  const raw = chunks.join("\n\n").slice(0, 24000);

  // 2. Ask the AI to rewrite the scraped text into a clean, structured knowledge base.
  const { aiGenerate } = await import("@/lib/support/ai");
  const system = `You compile the internal knowledge base for the Backhome Buddy support assistant. You are given raw text scraped from the company's website. Rewrite it into a clean, well-organised, factual knowledge base the assistant can use to answer clients and buddies.
RULES:
- Use clear section headings (ABOUT, SERVICES, HOW IT WORKS, PRICING, COVERAGE, PROOF & TRUST, PRIVACY, CONTACT, etc.).
- Keep only durable facts: services, process, coverage, policies, contact details. Drop marketing fluff, menus, cookie notices, and repeated navigation text.
- NEVER invent facts not present in the source text. If something isn't in the source, leave it out.
- CRITICAL: never bake in a specific price figure. If pricing is mentioned, describe how pricing works (free quote, shown in-app, priced per task) but do not state exact dollar amounts as fixed prices.
- Keep it concise and under 18,000 characters.
- Output ONLY the knowledge base text — no preamble, no commentary.`;

  const out = await aiGenerate(system, `Raw website content:\n\n${raw}`);
  if (out.error) return { error: `Fetched ${fetched} page(s), but AI compilation failed: ${out.error}` };
  const draft = (out.text || "").trim();
  if (!draft || draft.length < 200) return { error: "The AI returned too little content — try again, or edit manually." };

  await db_audit(p.id, fetched, draft.length);
  // Return the DRAFT for review — admin clicks Save to apply it.
  return { error: "", draft, pagesRead: fetched };
}

async function db_audit(actorId: string, pages: number, chars: number) {
  try {
    const db = createAdminClient();
    await db.from("audit_log").insert({ actor_id: actorId, action: "refresh_knowledge_from_website", detail: { pages, chars } });
  } catch { /* non-fatal */ }
}
