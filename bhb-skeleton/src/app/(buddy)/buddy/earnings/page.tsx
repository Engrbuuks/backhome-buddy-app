import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/StatusPill";
import { formatNGN, formatDate } from "@/components/money";

export default async function EarningsPage() {
  const supabase = createClient();
  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, amount_ngn, status, created_at, requests(title)")
    .order("created_at", { ascending: false });
  const list = payouts ?? [];
  const pending = list.filter((p) => p.status === "pending" || p.status === "processing").reduce((s, p) => s + Number(p.amount_ngn), 0);
  const paid = list.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount_ngn), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold">Earnings</h1>
        <p className="mt-1 text-sm text-bbb-slate">Your payouts. Money is released after the client confirms completion.</p>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft"><p className="text-xs font-bold uppercase text-bbb-slate">Pending</p><p className="mt-1 font-display text-2xl font-extrabold">{formatNGN(pending)}</p></div>
        <div className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft"><p className="text-xs font-bold uppercase text-bbb-slate">Paid out</p><p className="mt-1 font-display text-2xl font-extrabold text-bbb-dark">{formatNGN(paid)}</p></div>
      </div>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No payouts yet — complete tasks to start earning.</div>
      ) : (
        <div className="space-y-3">
          {list.map((p: any) => (
            <article key={p.id} className="flex items-center justify-between rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div><p className="font-semibold">{p.requests?.title ?? "Task"}</p><p className="text-xs text-bbb-slate">{formatDate(p.created_at)}</p></div>
              <div className="flex items-center gap-4"><span className="font-bold">{formatNGN(Number(p.amount_ngn))}</span><StatusPill status={p.status} /></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
