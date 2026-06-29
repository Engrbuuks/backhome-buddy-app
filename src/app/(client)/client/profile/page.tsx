import { getCurrentProfile } from "@/lib/auth/roles";
import { listMyPayments } from "@/lib/client/actions";
import ProfileForm from "./ProfileForm";
import { StatusPill } from "@/components/StatusPill";
import { formatClientMoney, formatDate } from "@/components/money";

export default async function ClientProfilePage() {
  const [profile, payments] = await Promise.all([getCurrentProfile(), listMyPayments()]);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-extrabold">Profile</h1>
      <div className="mt-5"><ProfileForm initial={profile} /></div>
      <h2 className="mt-8 font-display text-lg font-extrabold">Payment history</h2>
      {payments.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-bbb-border bg-white p-6 text-center text-sm text-bbb-slate">No payments yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {payments.map((p: any) => (
            <article key={p.id} className="flex items-center justify-between rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div><p className="text-sm font-semibold">{p.requests?.title ?? "Request"}</p><p className="text-xs text-bbb-slate">{p.provider} · {formatDate(p.created_at)}</p></div>
              <div className="flex items-center gap-3"><span className="font-bold">{formatClientMoney(Number(p.amount_ngn), p.requests?.fx_rate)}</span><StatusPill status={p.funds_held ? "Held" : p.status} /></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
