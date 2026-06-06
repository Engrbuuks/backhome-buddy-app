/**
 * Server-only AI call for the support assistant.
 *
 * Provider selection (first match wins):
 *   1. GEMINI_API_KEY    → Google Gemini (free tier; model via GEMINI_MODEL,
 *                          default gemini-2.5-flash-lite)
 *   2. ANTHROPIC_API_KEY → Anthropic (model via ANTHROPIC_MODEL)
 *   3. Neither set       → graceful "team notified" fallback (no AI)
 *
 * Every call is grounded in the Knowledge Base (Admin → Knowledge Base),
 * which is compiled from backhomebuddy.ng and editable without a redeploy.
 */
import { getKnowledgeBase } from "@/lib/support/knowledge";

const SYSTEM_PROMPT = `You are the support assistant for Backhome Buddy (backhomebuddy.ng), a concierge service where Nigerian-diaspora clients request errands in Nigeria and vetted local "buddies" complete them with photo/video/report proof.

STRICT GROUNDING RULES:
- Answer ONLY from the KNOWLEDGE BASE below and any per-conversation context provided. If the answer is not covered there, do NOT guess — say the team has been notified and will follow up in this chat, and suggest submitting a request or scheduling a free WhatsApp call.
- Prices come only from official quotes after the team clarifies a request. NEVER invent, estimate, or hint at a price, fee, or range.
- NEVER promise a specific timeline; timelines are estimated by the team per task.
- Never reveal internal margins, buddy payouts, or other clients' data.
- Be warm, concise, and concrete. Where natural, guide the visitor toward signing up to submit a request (quotes are free) or scheduling a free call on WhatsApp.

KNOWLEDGE BASE:
`;

type Msg = { sender: string; content: string };

const FALLBACK_NO_KEY =
  "Our AI assistant isn't configured yet, but the team has been notified of your message and will reply here soon.";
const FALLBACK_EMPTY =
  "I couldn't generate a reply — the team has been notified and will follow up here.";
const FALLBACK_ERROR =
  "I'm having trouble answering right now — the team has been notified and will reply here shortly.";

export async function askClaude(history: Msg[], context: string): Promise<string> {
  const gemini = process.env.GEMINI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (!gemini && !anthropic) return FALLBACK_NO_KEY;

  const knowledge = await getKnowledgeBase();
  const system = `${SYSTEM_PROMPT}${knowledge}\n\nCONVERSATION CONTEXT:\n${context}`;
  const recent = history.slice(-12);

  try {
    const text = gemini
      ? await callGemini(gemini, system, recent)
      : await callAnthropic(anthropic as string, system, recent);
    return text.trim() || FALLBACK_EMPTY;
  } catch {
    return FALLBACK_ERROR;
  }
}

// ---------- Google Gemini (free tier) ----------
async function callGemini(apiKey: string, system: string, history: Msg[]): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  // Gemini wants alternating user/model turns; merge consecutive same-role messages.
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of history) {
    const role = m.sender === "user" ? "user" : "model";
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n${m.content}`;
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  if (!contents.length || contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Hello" }] });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 800, temperature: 0.4 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return ((data.candidates?.[0]?.content?.parts ?? []) as { text?: string }[])
    .map((p) => p.text ?? "")
    .join("\n");
}

// ---------- Anthropic ----------
async function callAnthropic(apiKey: string, system: string, history: Msg[]): Promise<string> {
  const messages = history.map((m) => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.content,
  }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return ((data.content ?? []) as { type: string; text?: string }[])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
}

// ---------- Generic one-shot generation for admin AI assists ----------
// Reuses the same provider chain (Gemini free tier first, then Anthropic).
// `images` are optional {mimeType, base64} attachments (Gemini multimodal).
export type AiImage = { mimeType: string; base64: string };

export async function aiGenerate(system: string, userText: string, images: AiImage[] = []): Promise<{ text?: string; error?: string }> {
  const gemini = process.env.GEMINI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (!gemini && !anthropic) return { error: "No AI key configured — add GEMINI_API_KEY in Vercel env vars." };
  try {
    if (gemini) {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
      const parts: any[] = [{ text: userText }];
      for (const img of images.slice(0, 8)) {
        parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
      }
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": gemini },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts }],
            generationConfig: { maxOutputTokens: 1800, temperature: 0.3 },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const data = await res.json();
      const text = ((data.candidates?.[0]?.content?.parts ?? []) as { text?: string }[])
        .map((q) => q.text ?? "").join("\n").trim();
      return text ? { text } : { error: "AI returned an empty response — try again." };
    }
    // Anthropic fallback (text + images)
    const content: any[] = images.slice(0, 8).map((img) => ({
      type: "image", source: { type: "base64", media_type: img.mimeType, data: img.base64 },
    }));
    content.push({ type: "text", text: userText });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": anthropic as string, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 1800, system,
        messages: [{ role: "user", content }],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const text = ((data.content ?? []) as { type: string; text?: string }[])
      .filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
    return text ? { text } : { error: "AI returned an empty response — try again." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI request failed." };
  }
}
