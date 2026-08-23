import { listLedger } from "@/lib/admin/ops-actions";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { formatNGN, formatDate } from "@/components/money";

export default async function LedgerPage() {
  const rows = await listLedger();
  return (
    <AdminShell title="Ledger">
      <PageHeader eyebrow="Money" title="Transactions ledger" description="Append-only record of every payment, payout and refund. The financial source of truth." />
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No transactions yet — record a payment to see the first entry.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((t: any) => (
            <article key={t.id} className="flex items-center justify-between rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t.requests?.title ?? "—"} <span className="ml-2 rounded bg-bbb-bg px-2 py-0.5 text-[11px] font-bold uppercase text-bbb-slate">{t.kind}</span></p>
                <p className="text-xs text-bbb-slate">{t.note ?? ""} · {formatDate(t.created_at)}</p>
              </div>
              <span className={`font-display font-extrabold ${Number(t.amount_ngn) < 0 ? "text-red-600" : "text-bbb-dark"}`}>{formatNGN(Number(t.amount_ngn))}</span>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
