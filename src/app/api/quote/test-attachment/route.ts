import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { buildQuotePdf } from "@/lib/pdf/quote-pdf";
import { sendEmailWithAttachments } from "@/lib/notifications/notify";
import { DEFAULT_RATES } from "@/lib/money/currency";

export const runtime = "nodejs";

/** Admin-only: emails a sample branded quote PDF to the logged-in admin, so you
 *  can confirm attachments actually arrive. Open while logged in as admin:
 *    /api/quote/test-attachment
 */
export async function GET() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });
  if (!p.email) return NextResponse.json({ error: "Your admin account has no email." }, { status: 400 });

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildQuotePdf({
      quoteNumber: "BHB-TEST-0001",
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      clientName: "Test Client", clientEmail: p.email,
      requestTitle: "Attachment test — sample quote",
      items: [{ label: "Sample line item", amountNgn: 45000 }, { label: "Another item", amountNgn: 10000 }],
      totalNgn: 55000, currency: "NGN", rates: DEFAULT_RATES, bank: null,
    });
  } catch (e) {
    return NextResponse.json({ error: `PDF build failed: ${e instanceof Error ? e.message : "unknown"}` }, { status: 500 });
  }

  const base64 = Buffer.from(pdfBytes).toString("base64");
  const r = await sendEmailWithAttachments(
    p.email, "Backhome Buddy — attachment test",
    "This is a test. A sample quote PDF should be attached to this email. If you can open the PDF, attachments are working.",
    [{ filename: "BHB-TEST-0001.pdf", content: base64 }]
  );

  return NextResponse.json({
    sent_to: p.email,
    pdf_bytes: pdfBytes.length,
    base64_length: base64.length,
    result: r?.error ? `FAILED: ${r.error}` : "✅ Sent — check your inbox for the PDF attachment.",
  });
}
