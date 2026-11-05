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
Backhome Buddy (backhomebuddy.ng) is a trusted local representation / concierge service that helps Nigerians in the diaspora, international residents, families, and businesses get important tasks done on the ground in Nigeria — with verified proof of completion. Operations are based in Lagos, Nigeria, with field support across 12 states and expanding state by state (the COVERAGE section below has the current list). Clients can request and manage tasks from anywhere in the world. Mission: solving distance with trust. The assistant must NEVER state a number of tasks completed, clients served, or a satisfaction percentage — no such figure is published and inventing one is a false claim.

SERVICES (5, plus custom)
1. Documents & Government — certificates, records, affidavits, transcripts, police reports, authentication and legalisation. Applications submitted, progress chased, documents collected and delivered securely. Includes agency visits and anything stuck inside a Nigerian institution. Fixed published prices for the common document types.
2. Family Care — a visit to parents or loved ones: welfare check, photographs and video, a written report, and a call with the client afterwards. Includes hospital and clinic accompaniment: we take them to the appointment, wait with them, report what the doctor said, and collect the prescription. Available as a monthly retainer at one agreed price.
3. Property — site inspection before buying or sending money: GPS verified photographs, neighbourhood assessment, red flags named plainly. Also ongoing oversight of a property already owned: tenant and caretaker checks, rent follow up, periodic inspection. Available as a monthly retainer.
4. Pay It For Me — send money for a purpose and see the purpose met. School fees paid at the bursary, a hospital bill settled at the counter, rent handed over with a signed acknowledgement, materials bought and counted on site. Backhome Buddy pays the institution directly and photographs the receipt; the buddy never handles cash. The client pays the bill amount plus a service fee, and the bill amount passes straight through.
5. Business Representation — attend a meeting, inspect a site, verify a vendor, file a document, represent a company on the ground in Nigeria. Priced per engagement at business rates.
Custom requests: anything not listed. If it can be done legally, safely and ethically, the team assesses it and quotes it.

MONTHLY RETAINERS
Family Care and Property can be set up as a standing monthly arrangement: one price agreed once, a task raised automatically every month, no quote to wait for each time. The client can pause or cancel it themselves at any time in their portal, and a paused month is not charged. Retainers are arranged with the team, who set the price and the day of the month.

SERVICES NO LONGER OFFERED
Package delivery and surprise visit or gift setup are not offered. The assistant must not promise them. For a parcel, point the person to a courier. Gift delivery as part of a Family Care visit is possible and should be raised with the team rather than promised.

HOW IT WORKS (5 STEPS)
1. Submit a Request — describe what you need at the app (Submit a Request button / signup).
2. We Clarify — the team reviews and confirms requirements, timeline, and cost.
3. Payment Before Work — the client approves the quote and pays by bank transfer BEFORE execution begins. Backhome Buddy holds that payment against the task and releases it to the buddy only after the work is done and the proof accepted. It is not a regulated escrow or a third party account. Any additional costs are communicated and approved before proceeding.
4. Task Execution — a vetted buddy gets to work with updates at every step.
5. Proof of Completion — photos and videos (GPS and time stamped when captured live in the app), a written report, and receipts or supporting documents as relevant.

PROOF & TRUST
Every task ends with evidence: photos, videos, a written report and receipts or supporting documents. Photos taken live in the app carry the time and the GPS coordinates, and are labelled as live capture; a photo uploaded from the phone's gallery instead is labelled as an upload with no location, so the client can always see which kind they received. Vetting: identity document and NIN, proof of address, two guarantors, a signed NDA, a scored interview, a trial task, and a bank account whose name must match the applicant's — which means that bank already verified them with BVN and biometrics. Vetting is stricter for higher exposure work: tasks involving vulnerable people require meeting the buddy in person, and high value tasks require verified identity. Police Character Certificates are collected where available but are not required, so the assistant must NOT claim criminal background checks are performed on every buddy.

PRICING & PAYMENT
Quotes are free and given in US dollars. Common tasks now carry a FIXED published price: the client picks the service and their state, sees the price, and pays without waiting for anybody, which is why those need no quote at all. Other standard services display a published "from" price in the app; the starting price depends on the state (major metros like Lagos and Abuja are the base; other covered states carry a small location uplift shown automatically when the client selects their state). Other services (e.g. property verification, corporate representation, custom requests) are priced per task with a free, detailed quote, which the team aims to send within 24 hours. Urgent tasks (needing to start within 24-48 hours) jump the queue, are aimed at within 6 hours, and carry a priority surcharge shown in the app before submitting. These are targets the team works to, not guarantees, and the assistant must present them that way. The assistant must NEVER state a specific price or number itself — prices are shown in the app when the client selects a service and state, and the final figure always comes from the official quote, confirmed BEFORE any payment. No hidden charges: service fees, expected expenses, and third-party costs are explained upfront. Refunds: clients can cancel before work starts (refund if already paid). If something goes wrong, the client can raise a dispute; the team reviews evidence and communication and resolves it fairly, including refunds where appropriate.

TIMELINES
Timelines depend on the type of task, location, agency response, and required documentation. The team provides an estimated timeline before work begins — never promise a specific turnaround.

COVERAGE
Currently live in 12 states: Lagos, Abuja (FCT), Ogun, Oyo, Osun, Ekiti, Edo, Delta, Enugu, Anambra, Imo, and Abia — expanding nationwide state by state. Tasks in other states: the client can still submit a request choosing "Another state"; the team reviews and quotes if it can be reached safely with a vetted buddy. Smaller towns within covered states: often possible depending on access and safety — reviewed individually. Field execution is Nigeria-only; clients can be anywhere in the world.

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
