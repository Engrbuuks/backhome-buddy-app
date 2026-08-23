"use client";
import { Download } from "lucide-react";

/** Optional download: opens the browser print dialog, from which the admin can
 *  "Save as PDF". Keeps download optional — viewing needs no action. */
export default function NdaPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl border border-bbb-border bg-white px-4 py-2 text-sm font-bold text-bbb-charcoal hover:bg-bbb-bg"
    >
      <Download className="h-4 w-4" />
      Download / Print PDF
    </button>
  );
}
