import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";
import { formatMoneyPdf, CURRENCY_META, type Currency, type RateMap } from "@/lib/money/currency";
import type { BankDetail } from "@/lib/money/fx";

const GREEN = rgb(0x07 / 255, 0x95 / 255, 0x16 / 255);
const DARK = rgb(0x15 / 255, 0x80 / 255, 0x3d / 255);
const DEEP = rgb(0x0b / 255, 0x42 / 255, 0x1b / 255);
const CHARCOAL = rgb(0x1d / 255, 0x1d / 255, 0x1f / 255);
const SLATE = rgb(0.42, 0.45, 0.5);
const LIGHT = rgb(0.9, 0.92, 0.91);
const SOFT = rgb(0xea / 255, 0xfb / 255, 0xe8 / 255);
const WHITE = rgb(1, 1, 1);

export type QuotePdfInput = {
  quoteNumber: string;
  date: string;
  clientName: string;
  clientEmail?: string | null;
  requestTitle: string;
  items: Array<{ label: string; amountNgn: number }>;
  totalNgn: number;
  currency: Currency;
  rates: RateMap;
  bank?: BankDetail | null;
  validityNote?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
};

/** Branded A4 quote/invoice PDF, laid out after the client's reference sample:
 *  a patterned green side band, two-column header, green table header, a
 *  payment + terms block and a grand-total chip. Returns PDF bytes. */
export async function buildQuotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const money = (ngn: number) => formatMoneyPdf(ngn, input.currency, input.rates);

  // Replace characters the standard PDF font (WinAnsi) cannot encode, so the
  // build can never crash on an unexpected glyph (smart quotes, dashes, ₦, emoji,
  // accents). Common typographic characters get sensible ASCII equivalents.
  const REPLACEMENTS: Record<string, string> = {
    "\u20a6": "NGN ", "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
    "\u2013": "-", "\u2014": "-", "\u2026": "...", "\u2022": "-", "\u00a0": " ",
    "\u2192": "->", "\u2713": "", "\u2705": "", "\ufe0f": "",
  };
  const safe = (s: string): string => {
    if (!s) return "";
    let out = "";
    for (const ch of String(s)) {
      const code = ch.codePointAt(0) || 0;
      if (REPLACEMENTS[ch] !== undefined) { out += REPLACEMENTS[ch]; continue; }
      // WinAnsi safe range: printable ASCII + Latin-1 supplement.
      if (code <= 0xff) out += ch;
      else out += ""; // drop anything else (emoji, other scripts) rather than crash
    }
    return out;
  };
  const draw = (text: string, opts: any): void => { page.drawText(safe(text), opts); };

  // ---------- Left decorative band ----------
  const bandW = 74;
  page.drawRectangle({ x: 0, y: 0, width: bandW, height, color: DEEP });
  try {
    const patPath = path.join(process.cwd(), "public", "images", "quote-pattern.png");
    const pat = await doc.embedPng(fs.readFileSync(patPath));
    // tile the pattern down the band
    const tileW = bandW;
    const scale = tileW / pat.width;
    const tileH = pat.height * scale;
    for (let yy = height; yy > -tileH; yy -= tileH) {
      page.drawImage(pat, { x: 0, y: yy - tileH, width: tileW, height: tileH });
    }
  } catch { /* band stays solid if pattern missing */ }

  const CX = bandW + 34;            // content left edge
  const RX = width - 40;            // content right edge
  let y = height - 60;

  // ---------- Header: logo (left) + INVOICE/QUOTE (right) ----------
  try {
    const logoPath = path.join(process.cwd(), "public", "images", "logo.png");
    const png = await doc.embedPng(fs.readFileSync(logoPath));
    const th = 30; const sc = th / png.height;
    page.drawImage(png, { x: CX, y: y - th + 6, width: png.width * sc, height: th });
  } catch {
    draw("Backhome Buddy", { x: CX, y: y - 16, size: 16, font: bold, color: DARK });
  }
  const titleTxt = "QUOTE";
  draw(titleTxt, { x: RX - bold.widthOfTextAtSize(titleTxt, 34), y: y - 24, size: 34, font: bold, color: CHARCOAL });
  // green underline under the title (like the sample's gold rule)
  page.drawRectangle({ x: CX, y: y - 40, width: RX - CX, height: 3, color: GREEN });
  y -= 66;

  // ---------- Meta: quote no + date (left), prepared for (right) ----------
  draw("QUOTE NUMBER", { x: CX, y, size: 7.5, font: bold, color: GREEN });
  draw(input.quoteNumber, { x: CX, y: y - 13, size: 11, font: bold, color: CHARCOAL });
  draw("QUOTE DATE", { x: CX, y: y - 34, size: 7.5, font: bold, color: GREEN });
  draw(input.date, { x: CX, y: y - 47, size: 11, font: bold, color: CHARCOAL });

  const metaR = RX - 190;
  draw("QUOTE TO:", { x: metaR, y, size: 7.5, font: bold, color: GREEN });
  draw(input.clientName || "Client", { x: metaR, y: y - 13, size: 11, font: bold, color: CHARCOAL });
  if (input.clientEmail) draw(input.clientEmail, { x: metaR, y: y - 28, size: 9, font, color: SLATE });
  const rt = (input.requestTitle || "Custom request").slice(0, 40);
  draw(rt, { x: metaR, y: y - 42, size: 9, font, color: SLATE });
  y -= 78;

  // ---------- Items table ----------
  const colDesc = CX + 12;
  const colAmt = RX - 12;
  page.drawRectangle({ x: CX, y: y - 7, width: RX - CX, height: 28, color: DARK });
  draw("DESCRIPTION", { x: colDesc, y, size: 9, font: bold, color: WHITE });
  draw("AMOUNT", { x: colAmt - bold.widthOfTextAtSize("AMOUNT", 9), y, size: 9, font: bold, color: WHITE });
  y -= 34;

  for (const it of input.items) {
    draw((it.label || "").slice(0, 52), { x: colDesc, y, size: 10, font, color: CHARCOAL });
    const a = money(it.amountNgn);
    draw(a, { x: colAmt - font.widthOfTextAtSize(a, 10), y, size: 10, font, color: CHARCOAL });
    y -= 11;
    page.drawLine({ start: { x: CX, y }, end: { x: RX, y }, thickness: 0.5, color: LIGHT });
    y -= 17;
  }
  y -= 10;

  // ---------- Payment method (left) + Grand total chip (right) ----------
  const blockTop = y;
  // Payment details
  draw("Payment Method:", { x: CX, y, size: 11, font: bold, color: CHARCOAL });
  let py = y - 18;
  if (input.bank && input.bank.account_number) {
    const b = input.bank;
    const rows: Array<[string, string]> = [];
    if (b.bank_name) rows.push(["Bank", b.bank_name]);
    if (b.account_name) rows.push(["Account name", b.account_name]);
    if (b.account_number) rows.push(["Account number", b.account_number]);
    if (b.extra) rows.push(["Sort/SWIFT/Routing", b.extra]);
    for (const [k, v] of rows) {
      draw(k, { x: CX, y: py, size: 8.5, font, color: SLATE });
      draw(v, { x: CX + 96, y: py, size: 9.5, font: bold, color: CHARCOAL });
      py -= 15;
    }
  } else {
    draw("Bank transfer — details provided by our team.", { x: CX, y: py, size: 9, font, color: SLATE });
    py -= 15;
  }

  // Totals (right column)
  const totX = RX - 250;
  const totLabelX = totX + 14;
  const totValX = RX - 14;
  let ty = blockTop + 4;
  const subtotal = money(input.totalNgn);
  draw("Sub Total", { x: totLabelX, y: ty, size: 10, font: bold, color: CHARCOAL });
  draw(subtotal, { x: totValX - bold.widthOfTextAtSize(subtotal, 10), y: ty, size: 10, font: bold, color: CHARCOAL });
  ty -= 30;
  // grand total chip
  page.drawRectangle({ x: totX, y: ty - 12, width: 250, height: 40, color: GREEN });
  draw("Grand Total", { x: totLabelX, y: ty, size: 11, font: bold, color: WHITE });
  const gt = money(input.totalNgn);
  draw(gt, { x: totValX - bold.widthOfTextAtSize(gt, 16), y: ty - 3, size: 16, font: bold, color: WHITE });

  y = Math.min(py, ty - 30) - 24;

  // ---------- Terms & conditions ----------
  draw("Terms & Conditions", { x: CX, y, size: 11, font: bold, color: CHARCOAL });
  y -= 16;
  const note = input.validityNote || "This quote is provisional and may be revised if the scope of work changes. Nothing is charged until you accept and pay. Work begins once payment is confirmed. Please use your request title as the transfer reference.";
  for (const line of wrap(safe(note), font, 9, RX - CX)) { draw(line, { x: CX, y, size: 9, font, color: SLATE }); y -= 13; }
  y -= 14;

  // ---------- Thanks + contact ----------
  draw("Thank you for your business", { x: CX, y, size: 11, font: bold, color: DARK });
  y -= 20;
  const contact: string[] = [];
  if (input.companyPhone) contact.push(`P : ${input.companyPhone}`);
  if (input.companyEmail) contact.push(`E : ${input.companyEmail}`);
  if (input.companyAddress) contact.push(`A : ${input.companyAddress}`);
  for (const c of contact) { draw(c, { x: CX, y, size: 8.5, font, color: SLATE }); y -= 13; }

  // ---------- Footer strip ----------
  page.drawRectangle({ x: bandW, y: 0, width: width - bandW, height: 5, color: GREEN });
  draw("Backhome Buddy — Your Tasks Handled Right.", { x: CX, y: 18, size: 8, font: bold, color: DARK });

  return doc.save();
}

function wrap(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) { if (cur) lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
