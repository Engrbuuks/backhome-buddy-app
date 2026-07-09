"use client";
import React, { useMemo, useState, useTransition } from "react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ChevronDown, ChevronUp, Plus, X, Send, AlertTriangle } from "lucide-react";
import { saveNotifSettings, sendTestNotification } from "@/lib/admin/notification-settings-actions";

type Cfg = { enabled: boolean; subject?: string; body?: string; recipientOverride?: string };
type Def = { key: string; label: string; audience: string; essential: boolean; group: string; defaultSubject: string };
type Settings = { types: Record<string, Cfg>; teamEmails: string[]; fromAddress?: string; replyTo?: string };

export default function NotificationSettings({ initialSettings, defs }: { initialSettings: Settings; defs: Def[] }) {
  const [s, setS] = useState<Settings>(initialSettings);
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [testTo, setTestTo] = useState("");

  const groups = useMemo(() => {
    const g: Record<string, Def[]> = {};
    for (const d of defs) (g[d.group] ||= []).push(d);
    return g;
  }, [defs]);

  const cfg = (k: string): Cfg => s.types[k] || { enabled: true };
  const setCfg = (k: string, patch: Partial<Cfg>) =>
    setS((prev) => ({ ...prev, types: { ...prev.types, [k]: { ...cfg(k), ...patch } } }));

  const toggle = (d: Def) => {
    const current = cfg(d.key).enabled;
    if (current && d.essential) {
      if (!confirm(`“${d.label}” is an essential notification (money or onboarding). Turning it off may leave clients or buddies confused or blocked. Are you sure you want to disable it?`)) return;
    }
    setCfg(d.key, { enabled: !current });
  };

  const save = () => start(async () => {
    setErr(""); setMsg("");
    const res = await saveNotifSettings(s);
    if (res.error) setErr(res.error); else setMsg("Notification settings saved. Changes apply to the next notification.");
  });

  const test = () => start(async () => {
    setErr(""); setMsg("");
    const res = await sendTestNotification(testTo);
    if (res.error) setErr(res.error); else setMsg(`Test email sent to ${testTo}.`);
  });

  const addTeam = () => setS((p) => ({ ...p, teamEmails: [...p.teamEmails, ""] }));
  const setTeam = (i: number, v: string) => setS((p) => ({ ...p, teamEmails: p.teamEmails.map((e, idx) => idx === i ? v : e) }));
  const removeTeam = (i: number) => setS((p) => ({ ...p, teamEmails: p.teamEmails.filter((_, idx) => idx !== i) }));

  return (
    <AdminShell title="Notification Settings">
      <PageHeader eyebrow="Communications" title="Notification emails"
        description="Control every notification email: switch each on or off, edit its wording, and set who receives it. Changes apply immediately to the next notification — no redeploy." />

      {(msg || err) && (
        <div className={`mb-4 rounded-2xl p-3 text-sm font-semibold ${err ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{err || msg}</div>
      )}

      {/* Addresses card */}
      <div className="mb-5 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <p className="font-display text-base font-extrabold">Addresses</p>
        <p className="mt-1 text-xs text-bbb-slate">Where team alerts go, and the sender identity on every email.</p>

        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Team alert recipients</p>
          <p className="mb-2 text-xs text-bbb-slate">These addresses receive internal alerts (new request, dispute, proof to review, new buddy).</p>
          <div className="space-y-2">
            {s.teamEmails.length === 0 && <p className="text-xs italic text-bbb-slate">No team addresses set — team alerts won't be emailed until you add one.</p>}
            {s.teamEmails.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={e} onChange={(ev) => setTeam(i, ev.target.value)} placeholder="ops@backhomebuddy.ng"
                  className="w-full max-w-md rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
                <button onClick={() => removeTeam(i)} className="grid h-8 w-8 place-items-center rounded-lg text-bbb-slate hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={addTeam} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-bbb-strong hover:underline"><Plus className="h-3.5 w-3.5" /> Add team address</button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Sender (from)</p>
            <p className="mb-1 text-xs text-bbb-slate">Leave blank to use the default. Format: Name &lt;email&gt;.</p>
            <input value={s.fromAddress || ""} onChange={(e) => setS((p) => ({ ...p, fromAddress: e.target.value }))}
              placeholder="Backhome Buddy <notifications@backhomebuddy.ng>"
              className="w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Reply-to</p>
            <p className="mb-1 text-xs text-bbb-slate">Where replies should go. Optional.</p>
            <input value={s.replyTo || ""} onChange={(e) => setS((p) => ({ ...p, replyTo: e.target.value }))}
              placeholder="support@backhomebuddy.ng"
              className="w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
          </div>
        </div>

        {/* Test */}
        <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-bbb-border pt-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Send a test email</p>
            <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com"
              className="mt-1 w-64 rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
          </div>
          <button onClick={test} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-bbb-border px-4 py-2 text-sm font-bold text-bbb-slate hover:border-bbb-strong disabled:opacity-50"><Send className="h-3.5 w-3.5" /> Send test</button>
        </div>
      </div>

      {/* Notification types by group */}
      {Object.entries(groups).map(([group, list]) => (
        <div key={group} className="mb-5 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
          <p className="mb-3 font-display text-base font-extrabold">{group}</p>
          <div className="space-y-2">
            {list.map((d) => {
              const c = cfg(d.key);
              const isOpen = open === d.key;
              return (
                <div key={d.key} className="rounded-2xl border border-bbb-border">
                  <div className="flex items-center justify-between gap-3 p-3">
                    <button onClick={() => setOpen(isOpen ? null : d.key)} className="flex min-w-0 items-center gap-2 text-left">
                      {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-bbb-slate" /> : <ChevronDown className="h-4 w-4 shrink-0 text-bbb-slate" />}
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-bold text-sm">{d.label}</span>
                          {d.essential && <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"><AlertTriangle className="h-2.5 w-2.5" /> Essential</span>}
                          <span className="rounded bg-bbb-bg px-1.5 py-0.5 text-[10px] font-bold text-bbb-slate capitalize">{d.audience}</span>
                        </span>
                        <span className="block truncate text-xs text-bbb-slate">{c.subject || d.defaultSubject}</span>
                      </span>
                    </button>
                    {/* toggle */}
                    <button onClick={() => toggle(d)} role="switch" aria-checked={c.enabled}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${c.enabled ? "bg-bbb-strong" : "bg-gray-300"}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${c.enabled ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="space-y-3 border-t border-bbb-border p-3">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Subject</label>
                        <input value={c.subject ?? ""} onChange={(e) => setCfg(d.key, { subject: e.target.value })}
                          placeholder={d.defaultSubject}
                          className="mt-1 w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Body (leave blank to use the built-in wording)</label>
                        <textarea value={c.body ?? ""} onChange={(e) => setCfg(d.key, { body: e.target.value })} rows={3}
                          placeholder="Uses the default message for this notification unless you set custom text here."
                          className="mt-1 w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
                      </div>
                      {d.audience !== "team" && (
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Recipient override</label>
                          <p className="text-[11px] text-bbb-slate">Normally goes to the {d.audience}. Set an address here to redirect this specific notification instead.</p>
                          <input value={c.recipientOverride ?? ""} onChange={(e) => setCfg(d.key, { recipientOverride: e.target.value })}
                            placeholder={`Default: the ${d.audience}'s own email`}
                            className="mt-1 w-full max-w-md rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Save bar */}
      <div className="sticky bottom-4 rounded-2xl border border-bbb-border bg-white p-3 shadow-soft">
        <button onClick={save} disabled={pending} className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
          {pending ? "Saving…" : "Save notification settings"}
        </button>
      </div>
    </AdminShell>
  );
}
