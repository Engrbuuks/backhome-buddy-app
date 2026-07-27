import Link from "next/link";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { StatusPill } from "@/components/StatusPill";
import { formatNGN, formatDate } from "@/components/money";
import { getDashboardStats } from "@/lib/admin/dashboard-actions";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/roles";
import {
  FileText, CreditCard, Loader, ShieldCheck, AlertTriangle, CheckCircle2,
  Users, UserPlus, Wallet, TrendingUp, ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");
  const s = await getDashboardStats();
  if (!s) redirect("/login");

  // Action items — only show the ones that need attention (count > 0).
  const actions = [
    { n: s.kpis.awaitingQuote, label: "Awaiting quote", href: "/admin/requests", icon: FileText, tone: "amber" },
    { n: s.kpis.proofToReview, label: "Proof to review", href: "/admin/proofs", icon: ShieldCheck, tone: "green" },
    { n: s.kpis.disputed, label: "Open disputes", href: "/admin/disputes", icon: AlertTriangle, tone: "red" },
    { n: s.supply.buddiesReview, label: "Buddies to vet", href: "/admin/buddies", icon: Users, tone: "amber" },
    { n: s.supply.recruitsApplied, label: "Applicants to interview", href: "/admin/recruitment", icon: UserPlus, tone: "green" },
    { n: s.kpis.awaitingPay, label: "Awaiting payment", href: "/admin/requests", icon: CreditCard, tone: "slate" },
  ].filter((a) => a.n > 0);

  const kpis = [
    { label: "Awaiting quote", value: s.kpis.awaitingQuote, icon: FileText },
    { label: "Awaiting payment", value: s.kpis.awaitingPay, icon: CreditCard },
    { label: "In execution", value: s.kpis.inExecution, icon: Loader },
    { label: "Completed", value: s.kpis.completedAll, icon: CheckCircle2 },
  ];

  const maxTrend = Math.max(1, ...s.trend.map((d) => d.count));

  return (
    <AdminShell title="Dashboard">
      <PageHeader eyebrow="Operations" title="Dashboard" description="Everything that needs your attention, and the health of the business at a glance." />

      {/* ACTION NEEDED */}
      {actions.length > 0 && (
        <div className="mb-6 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <p className="mb-3 flex items-center gap-2 font-display text-base font-extrabold"><AlertTriangle className="h-4 w-4 text-amber-500" /> Needs your attention</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => {
              const tone = a.tone === "red" ? "border-red-200 bg-red-50 text-red-700"
                : a.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700"
                : a.tone === "green" ? "border-green-200 bg-green-50 text-green-700"
                : "border-bbb-border bg-bbb-bg text-bbb-charcoal";
              const Icon = a.icon;
              return (
                <Link key={a.label} href={a.href} className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold hover:opacity-80 ${tone}`}>
                  <Icon className="h-4 w-4" />
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white/70 px-1.5 text-xs">{a.n}</span>
                  {a.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* MONEY */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MoneyCard icon={Wallet} label="Funds held (in escrow)" value={formatNGN(s.money.heldNgn)} sub="Client money awaiting completion" tone="slate" />
        <MoneyCard icon={TrendingUp} label="Revenue this month" value={formatNGN(s.money.monthRevenueNgn)} sub="Paid requests, month to date" tone="green" />
        <MoneyCard icon={CreditCard} label="Payouts due" value={formatNGN(s.money.payoutDueNgn)} sub="To buddies for completed work" tone="amber" href="/admin/payouts" />
      </div>

      {/* CLIENTS */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Link href="/admin/clients" className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft hover:border-bbb-strong">
          <div className="mb-1 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Total clients</p><Users className="h-4 w-4 text-bbb-strong" /></div>
          <p className="font-display text-3xl font-extrabold">{s.clients.total}</p>
          <p className="mt-0.5 text-[11px] text-bbb-slate">Everyone signed up as a client</p>
        </Link>
        <Link href="/admin/clients" className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft hover:border-bbb-strong">
          <div className="mb-1 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">New clients this month</p><UserPlus className="h-4 w-4 text-green-600" /></div>
          <p className="font-display text-3xl font-extrabold">{s.clients.thisMonth}</p>
          <p className="mt-0.5 text-[11px] text-bbb-slate">Signed up since the 1st</p>
        </Link>
        <Link href="/admin/clients" className="flex items-center justify-center rounded-2xl border border-dashed border-bbb-border bg-white p-5 text-sm font-bold text-bbb-strong shadow-soft hover:border-bbb-strong">
          View all clients <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">{k.label}</p>
                <Icon className="h-4 w-4 text-bbb-slate" />
              </div>
              <p className="font-display text-3xl font-extrabold">{k.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* TREND CHART */}
        <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft lg:col-span-2">
          <p className="mb-4 font-display text-base font-extrabold">New requests — last 7 days</p>
          <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
            {s.trend.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-lg bg-bbb-strong/85" style={{ height: `${(d.count / maxTrend) * 100}%`, minHeight: d.count > 0 ? 6 : 2 }} title={`${d.count} request(s)`} />
                </div>
                <span className="text-[11px] font-semibold text-bbb-slate">{d.label}</span>
                <span className="-mt-1 text-[11px] font-bold text-bbb-charcoal">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SUPPLY HEALTH */}
        <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <p className="mb-4 font-display text-base font-extrabold">Buddy supply</p>
          <SupplyRow label="Approved buddies" value={s.supply.buddiesApproved} href="/admin/buddies" />
          <SupplyRow label="Awaiting vetting" value={s.supply.buddiesReview} href="/admin/buddies" tone="amber" />
          <SupplyRow label="New recruits" value={s.supply.recruitsNew} href="/admin/recruitment" />
          <SupplyRow label="Applied (to interview)" value={s.supply.recruitsApplied} href="/admin/recruitment" tone="green" />
        </div>
      </div>

      {/* RECENT REQUESTS */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold">Recent requests</h2>
        <Link href="/admin/requests" className="inline-flex items-center gap-1 text-sm font-bold text-bbb-strong hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      {s.recent.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No requests yet.</div>
      ) : (
        <div className="mt-3 space-y-3">
          {s.recent.map((r: any) => (
            <Link key={r.id} href={`/admin/requests/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft hover:border-bbb-strong">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="text-xs text-bbb-slate">{r.profiles?.full_name ?? "—"} · {formatDate(r.created_at)}</p>
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

function MoneyCard({ icon: Icon, label, value, sub, tone, href }: any) {
  const bar = tone === "green" ? "text-green-600" : tone === "amber" ? "text-amber-600" : "text-bbb-slate";
  const inner = (
    <div className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft hover:border-bbb-strong">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">{label}</p>
        <Icon className={`h-4 w-4 ${bar}`} />
      </div>
      <p className="font-display text-2xl font-extrabold">{value}</p>
      <p className="mt-0.5 text-[11px] text-bbb-slate">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SupplyRow({ label, value, href, tone }: { label: string; value: number; href: string; tone?: string }) {
  const badge = tone === "amber" ? "bg-amber-100 text-amber-700" : tone === "green" ? "bg-green-100 text-green-700" : "bg-bbb-bg text-bbb-charcoal";
  return (
    <Link href={href} className="flex items-center justify-between border-b border-bbb-border py-2.5 last:border-0 hover:opacity-75">
      <span className="text-sm font-semibold text-bbb-charcoal">{label}</span>
      <span className={`grid h-7 min-w-7 place-items-center rounded-full px-2 text-sm font-bold ${badge}`}>{value}</span>
    </Link>
  );
}
