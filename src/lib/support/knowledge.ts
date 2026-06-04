import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Knowledge base for the AI support assistant.
 *
 * The DEFAULT text below was compiled from backhomebuddy.ng (services, how it
 * works, FAQs, about). Admins can override it any time from
 * Admin → Knowledge Base — the edited version is stored in app_settings under
 * the key 'support_knowledge_base' and takes precedence over this default.
 * No migration needed: if the row doesn't exist, the default is used.
 */
export const KNOWLEDGE_SETTING_KEY = "support_knowledge_base";

export const DEFAULT_KNOWLEDGE = `ABOUT BACKHOME BUDDY
Backhome Buddy (backhomebuddy.ng) is a trusted local representation / concierge service that helps Nigerians in the diaspora, international residents, families, and businesses get important tasks done on the ground in Nigeria — with verified proof of completion. Operations are based in Lagos, Nigeria, with field support across major Nigerian cities and all 36 states. Clients can request and manage tasks from anywhere in the world. Mission: solving distance with trust. Track record: 2,500+ tasks completed, 500+ diaspora clients, 36 states covered, 98% client satisfaction.

SERVICES (8)
1. Family Welfare Check — visit parents/loved ones, welfare assessment, photos & videos, written report, follow-up support. Can be scheduled as a recurring task (e.g. monthly).
2. Property Verification — site inspection before you invest or send money: GPS verification, photos & videos, neighborhood assessment, red-flag identification.
3. Document Processing — application support, submission assistance, progress tracking, collection coordination, secure delivery (certificates, records, affidavits, official documents).
4. Package Delivery — pickup and delivery nationwide (medications, gifts, supplies) with recipient confirmation, photo evidence, and delivery updates.
5. Surprise Visits — planning support, gift coordination, delivery & setup, photos & videos for birthdays, anniversaries, and special moments.
6. Government Errands — agency visits, status updates, documentation coordination, progress reports (no long queues for the client).
7. Corporate Representation — meeting attendance, site visits, inspection reports, vendor verification, photo & video documentation.
8. Custom Requests — anything not listed: the team assesses it, and if it can be done legally, safely, and ethically, provides guidance and a quote.

HOW IT WORKS (5 STEPS)
1. Submit a Request — describe what you need at the app (Submit a Request button / signup).
2. We Clarify — the team reviews and confirms requirements, timeline, and cost.
3. Secure Payment — client approves the quote and pays securely BEFORE execution begins. Any additional costs are communicated clearly before proceeding.
4. Task Execution — a vetted buddy gets to work with updates at every step.
5. Proof of Completion — photos, videos, GPS verification, written report, and receipts/supporting documents as relevant.

PROOF & TRUST
Every task ends with verifiable evidence: timestamped photos, videos, GPS-tagged location verification, detailed written reports, and receipts/documents. Every buddy goes through strict vetting: application screening + background checks, identity/address/reference verification, training (service standards, ethics, safety), location- and skill-based deployment, and ongoing quality reviews.

PRICING & PAYMENT
Quotes are free. Prices come only from official quotes after the team clarifies the request — there is no public price list, and the assistant must never invent or estimate a price. Quotes are given in US dollars. Payment is made securely before work begins. No hidden charges: service fees, expected expenses, and third-party costs are explained upfront. Refunds: clients can cancel before work starts (refund if already paid). If something goes wrong, the client can raise a dispute; the team reviews evidence and communication and resolves it fairly, including refunds where appropriate.

TIMELINES
Timelines depend on the type of task, location, agency response, and required documentation. The team provides an estimated timeline before work begins — never promise a specific turnaround.

COVERAGE
All 36 Nigerian states, fastest turnaround in major cities and their surrounding areas. Smaller towns: often possible depending on access, safety, and availability of a vetted buddy — each request is reviewed individually. Field execution is Nigeria-only; clients can be anywhere in the world.

PRIVACY
Tasks and personal information are handled confidentially; only what is necessary to complete the task is shared.

CONTACT & NEXT STEPS
- Submit a request / get a free quote: sign up in the app (the Submit a Request button on the website).
- Schedule a free call: WhatsApp +234 816 528 5609 (https://wa.me/2348165285609).
- Phone: +234 805 555 5969. Location: Lagos, Nigeria.
- Become a Buddy: apply through the Become a Buddy link on the website.
- Updates come via the client's preferred channel: WhatsApp, email, phone, or video call where required, plus tracking in the app from submission to proof.`;

/** Effective knowledge base: admin-edited value if present, else the default. */
export async function getKnowledgeBase(): Promise<string> {
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("app_settings")
      .select("value")
      .eq("key", KNOWLEDGE_SETTING_KEY)
      .maybeSingle();
    const text = (data?.value as any)?.text;
    if (typeof text === "string" && text.trim()) return text;
  } catch {
    /* fall through to default */
  }
  return DEFAULT_KNOWLEDGE;
}
