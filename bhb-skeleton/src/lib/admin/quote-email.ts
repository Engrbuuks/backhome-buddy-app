"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientDisplay, getBankDetails } from "@/lib/money/fx";
import { buildQuotePdf } from "@/lib/pdf/quote-pdf";
import { sendEmailWithAttachments, notify } from "@/lib/notifications/notify";

/** Assemble the branded quote PDF for a request and email it to the client with
 *  the in-app link kept intact. Also creates the in-app notification. Reused by
 *  both the initial quote send and the "resend quote" action. */
export async function emailBrandedQuote(requestId: string): Promise<{ error: string }> {
  const db = createAdminClient();
  const { data: req } = await db.from("requests")
    .select("id, title, client_id, client_price_ngn, status, created_at, quote_items(label, amount_ngn), profiles!requests_client_id_fkey(full_name, email)")
    .eq("id", requestId).maybeSingle();
  if (!req) return { error: "Request not found." };
  const clientEmail = (req as any).profiles?.email as string | undefined;
  const clientName = (req as any).profiles?.full_name as string | undefined;

  const items = ((req as any).quote_items ?? []).map((q: any) => ({ label: q.label, amountNgn: Number(q.amount_ngn) }));
  const totalNgn = Number((req as any).client_price_ngn) || items.reduce((s: number, i: any) => s + i.amountNgn, 0);
  if (!items.length || !(totalNgn > 0)) return { error: "This request has no quote to send yet." };

  const [{ currency, rates }, banks] = await Promise.all([getClientDisplay((req as any).client_id), getBankDetails()]);
  const bank = banks[currency] || null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.backhomebuddy.ng";
  const link = `${appUrl}/client/requests/${requestId}`;
  const quoteNumber = `BHB-${new Date((req as any).created_at || Date.now()).getFullYear()}-${String(requestId).slice(0, 6).toUpperCase()}`;
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildQuotePdf({
      quoteNumber, date, clientName: clientName || "Client", clientEmail,
      requestTitle: (req as any).title || "Custom request",
      items, totalNgn, currency, rates, bank,
      companyPhone: process.env.COMPANY_PHONE || "+234 810 123 4567",
      companyEmail: process.env.COMPANY_EMAIL || "support@backhomebuddy.ng",
    });
  } catch (e) {
    return { error: `Could not build the quote PDF: ${e instanceof Error ? e.message : "unknown error"}` };
  }
  const base64 = Buffer.from(pdfBytes).toString("base64");
  if (!base64 || base64.length < 100) {
    return { error: "The generated PDF was empty — not sending a broken attachment." };
  }

  // Email with the branded PDF attached, link kept in the body.
  let emailedWithPdf = false;
  if (clientEmail) {
    const body = `Hi ${clientName?.split(" ")[0] || "there"},\n\nYour quote for "${(req as any).title}" is ready. We've attached it as a PDF for your records.\n\nYou can review the full details and proceed to payment using the button below.`;
    const r = await sendEmailWithAttachments(
      clientEmail, `Your quote for "${(req as any).title}"`, body,
      [{ filename: `${quoteNumber}.pdf`, content: base64 }], link
    );
    if (r?.error) return { error: r.error };
    emailedWithPdf = true;
  }

  // In-app notification (with link). Only mention the PDF if it actually went out.
  await notify(
    (req as any).client_id,
    "Your quote is ready",
    emailedWithPdf
      ? `We priced "${(req as any).title}" — your branded quote PDF is in your email, and you can review and pay online.`
      : `We priced "${(req as any).title}" — review and proceed to payment.`,
    link, "quote_ready"
  );
  return { error: "" };
}
