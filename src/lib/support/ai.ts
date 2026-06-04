/** Server-only Anthropic Messages API call. Needs ANTHROPIC_API_KEY in env. */
const SYSTEM_PROMPT = `You are the support assistant for Backhome Buddy (backhomebuddy.ng), a concierge service where Nigerian-diaspora clients request errands in Nigeria (property verification, deliveries, family welfare checks, document processing, government errands, corporate representation, surprise visits, custom requests) and vetted local "buddies" complete them with photo/video/report proof.

How it works for clients: submit a request → the team sends a quote in US dollars → pay (currently by transfer as advised by the team; card payments coming) → a vetted buddy is assigned → work happens → proof is uploaded and reviewed by the team → the client confirms completion (or it auto-confirms after a set number of days) → done. Clients can cancel before work starts (refund if already paid) and can "Raise an issue" on any active or finished task, which pauses it for team review.

Rules: be warm, concise, and concrete. Use the client's request context when provided. Prices come only from official quotes — never invent prices. For payment instructions, refunds, disputes, or anything account-specific you cannot see, say the team has been notified and will follow up in this chat. Never reveal internal margins, buddy payouts, or other clients' data.`;

export async function askClaude(history: { sender: string; content: string }[], context: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "Our AI assistant isn't configured yet, but the team has been notified of your message and will reply here soon.";
  const messages = history.slice(-12).map((m) => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.content,
  }));
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: `${SYSTEM_PROMPT}\n\n${context}`,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const text = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    return text || "I couldn't generate a reply — the team has been notified and will follow up here.";
  } catch {
    return "I'm having trouble answering right now — the team has been notified and will reply here shortly.";
  }
}
