import Link from "next/link";
import { listMyTasks } from "@/lib/buddy/actions";
import { getMyProfileSummary } from "@/lib/buddy/vetting-actions";
import { StatusPill } from "@/components/StatusPill";
import { formatNGN, formatDate } from "@/components/money";

function initials(name?: string) {
  if (!name) return "B";
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

export default async function BuddyDashboard() {
  const [tasks, profile] = await Promise.all([listMyTasks(), getMyProfileSummary()]);
  const guarantors = Array.isArray(profile?.guarantors) ? profile!.guarantors : [];
  const nok = profile?.next_of_kin && typeof profile.next_of_kin === "object" ? profile.next_of_kin : null;
  return (
    <div>
      {profile && (
        <div className="mb-6 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <div className="flex items-center gap-4">
            {profile.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={profile.photoUrl} alt="Your photo" className="h-16 w-16 shrink-0 rounded-full border border-bbb-border object-cover" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-bbb-bg text-lg font-extrabold text-bbb-strong">{initials(profile.profiles?.full_name)}</div>
            )}
            <div className="min-w-0">
              <p className="font-display text-lg font-extrabold">{profile.profiles?.full_name ?? "Your profile"}</p>
              <p className="truncate text-xs text-bbb-slate">{profile.profiles?.email}{profile.profiles?.phone ? ` · ${profile.profiles.phone}` : ""}</p>
              {!profile.photoUrl && (
                <Link href="/buddy/vetting" className="mt-1 inline-block text-xs font-bold text-bbb-strong">+ Add your passport photo</Link>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-bbb-bg p-3">
              <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Guarantors</p>
              {guarantors.length ? (
                <ul className="space-y-1 text-sm">
                  {guarantors.map((g: any, i: number) => (
                    <li key={i} className="text-bbb-charcoal">{g?.name || "—"}{g?.relationship ? <span className="text-bbb-slate"> · {g.relationship}</span> : null}{g?.phone ? <span className="text-bbb-slate"> · {g.phone}</span> : null}</li>
                  ))}
                </ul>
              ) : (
                <Link href="/buddy/vetting" className="text-xs font-bold text-bbb-strong">+ Add your guarantors</Link>
              )}
            </div>
            <div className="rounded-2xl bg-bbb-bg p-3">
              <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Next of kin</p>
              {nok ? (
                <p className="text-sm text-bbb-charcoal">{nok.name || "—"}{nok.relationship ? <span className="text-bbb-slate"> · {nok.relationship}</span> : null}{nok.phone ? <span className="text-bbb-slate"> · {nok.phone}</span> : null}</p>
              ) : (
                <Link href="/buddy/vetting" className="text-xs font-bold text-bbb-strong">+ Add your next of kin</Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold">My Tasks</h1>
        <p className="mt-1 text-sm text-bbb-slate">Tasks assigned to you. You only ever see your own.</p>
      </div>
      {tasks.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center">
          <h3 className="font-display text-lg font-bold">No tasks yet</h3>
          <p className="mt-1 max-w-sm text-sm text-bbb-slate">When the team assigns you a task, it appears here with your payout.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t: any) => (
            <Link key={t.id} href={`/buddy/tasks/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div className="min-w-0">
                <p className="truncate font-semibold">{t.title}</p>
                <p className="mt-0.5 text-xs text-bbb-slate">{t.service_types?.name ?? "Custom"} · {t.recipient_address || "—"} · {formatDate(t.created_at)}</p>
              </div>
              <div className="flex items-center gap-4">
                {t.buddy_payout_ngn != null && <span className="text-sm font-bold text-bbb-dark">{formatNGN(t.buddy_payout_ngn)}</span>}
                <StatusPill status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
