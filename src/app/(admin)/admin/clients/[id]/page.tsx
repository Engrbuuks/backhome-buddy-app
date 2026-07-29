import { getClientDetail } from "@/lib/admin/clients-actions";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { StatusPill } from "@/components/StatusPill";
import { formatNGN, formatDate } from "@/components/money";
import { getCurrentProfile } from "@/lib/auth/roles";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Mail, Phone, Calendar, ArrowLeft } from "lucide-react";
import ReengagementComposer from "./ReengagementComposer";
import ClientCurrencyPicker from "./ClientCurrencyPicker";
import ResetPasswordButton from "./ResetPasswordButton";
import DeleteClientButton from "./DeleteClientButton";
import { getClientDisplay } from "@/lib/money/fx";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");
  const c = await getClientDetail(params.id);
  if (!c) notFound();
  const { currency } = await getClientDisplay(params.id);

  return (
    <AdminShell title="Client">
      <Link href="/admin/clients" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-bbb-strong hover:underline"><ArrowLeft className="h-4 w-4" /> All clients</Link>
      <PageHeader eyebrow="Client" title={c.full_name || "Unnamed client"} description="Full profile, request history and activity." />

      {/* Contact + stats */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft lg:col-span-1">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Contact</p>
          <p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-bbb-slate" /> {c.email || "—"}</p>
          <p className="mt-2 flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-bbb-slate" /> {c.phone || "—"}</p>
          <p className="mt-2 flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-bbb-slate" /> Joined {formatDate(c.created_at)}</p>
          <div className="mt-4 border-t border-bbb-border pt-3">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Display currency</p>
            <ClientCurrencyPicker clientId={c.id} current={currency} />
            <p className="mt-1.5 text-[11px] text-bbb-slate">Sets what this client sees by default. They can toggle it themselves too.</p>
          </div>
          <div className="mt-4 border-t border-bbb-border pt-3">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Account</p>
            <ResetPasswordButton clientId={c.id} hasEmail={Boolean(c.email)} />
            <DeleteClientButton clientId={c.id} name={c.full_name || c.email || ""} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:col-span-2">
          <Stat label="Requests" value={String(c.stats.total)} />
          <Stat label="Paid" value={String(c.stats.paid)} />
          <Stat label="Total spend" value={c.stats.totalSpendNgn > 0 ? formatNGN(c.stats.totalSpendNgn) : "—"} />
        </div>
      </div>

      {/* Stalled banner + re-engagement */}
      {c.stalled && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-bold text-amber-800">This client looks stalled</p>
          <p className="mt-0.5 text-sm text-amber-700">{c.stalled.label}. You can send a warm re-engagement email below.</p>
          <ReengagementComposer clientId={c.id} clientName={c.full_name} hasEmail={Boolean(c.email)} />
        </div>
      )}
      {!c.stalled && c.email && (
        <div className="mb-6 rounded-2xl border border-bbb-border bg-white p-5 shadow-soft">
          <p className="font-bold text-bbb-charcoal">Send a message</p>
          <p className="mt-0.5 text-sm text-bbb-slate">Draft an email to this client with AI, review it, and send.</p>
          <ReengagementComposer clientId={c.id} clientName={c.full_name} hasEmail={Boolean(c.email)} />
        </div>
      )}

      {/* Request history */}
      <h2 className="mb-3 font-display text-lg font-extrabold">Request history</h2>
      {c.requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">This client hasn't made any requests yet.</div>
      ) : (
        <div className="space-y-3">
          {c.requests.map((r) => (
            <Link key={r.id} href={`/admin/requests/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft hover:border-bbb-strong">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.title || "Untitled request"}</p>
                <p className="text-xs text-bbb-slate">{formatDate(r.created_at)}</p>
              </div>
              <div className="flex items-center gap-4">
                {r.client_price_ngn != null && <span className="text-sm font-bold">{formatNGN(Number(r.client_price_ngn))}</span>}
                <StatusPill status={r.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}
