"use client";
import React, { useState, useTransition, useMemo } from "react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { StatusPill, statusLabel } from "@/components/StatusPill";
import { ErrorState } from "@/components/StateBlocks";
import { setBuddyVetting, createBuddyProfileRow, updateVettingCheck, saveVettingNotes, requestBuddyDocuments, requestBuddyAction } from "@/lib/admin/ops-actions";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteUser } from "@/lib/admin/proof-actions";
import { aiScreenBuddy } from "@/lib/ai/assist-actions";
import { BuddyFilterBar, applyBuddyFilters, EMPTY_BUDDY_FILTER, type BuddyFilterValue } from "./BuddyFilters";
import { VETTING_CHECKS } from "@/lib/admin/vetting-checks";
import { REQUESTABLE_ITEMS } from "@/lib/admin/request-documents";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="shrink-0 text-bbb-slate">{label}</span>
      <span className="text-right font-medium text-bbb-charcoal">{value ?? "—"}</span>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url?: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-bbb-border px-3 py-1.5 text-xs font-bold text-bbb-strong hover:border-bbb-strong">
      {label} <ExternalLink className="h-3 w-3" />
    </a>
  ) : (
    <span className="rounded-lg border border-dashed border-bbb-border px-3 py-1.5 text-xs font-semibold text-bbb-slate">{label}: not uploaded</span>
  );
}

function BuddyDetail({ b, pending, run }: { b: any; pending: boolean; run: (fn: () => Promise<{ error: string }>) => void }) {
  const checks = (b.vetting_checks ?? {}) as Record<string, boolean>;
  const doneCount = VETTING_CHECKS.filter(([k]) => checks[k]).length;
  const allDone = doneCount === VETTING_CHECKS.length;
  const [notes, setNotes] = useState(b.vetting_notes ?? "");
  const [screening, setScreening] = useState(false);
  const [reqItems, setReqItems] = useState<string[]>([]);
  const [reqSending, setReqSending] = useState(false);
  const [reqMsg, setReqMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const sendAction = async (action: "nda" | "guarantors") => {
    setActionBusy(action); setActionMsg("");
    const res = await requestBuddyAction(b.id, action);
    setActionBusy("");
    setActionMsg(res.error ? res.error : `✓ ${action === "nda" ? "NDA request" : "Guarantor request"} emailed to ${res.to}`);
  };
  const toggleReq = (k: string) => setReqItems((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
  const sendRequest = async () => {
    setReqSending(true); setReqMsg("");
    const res = await requestBuddyDocuments(b.id, reqItems);
    setReqSending(false);
    if (res.error) setReqMsg(res.error);
    else { setReqMsg(`✓ Sent ${res.sent} item${res.sent === 1 ? "" : "s"} to ${res.to}`); setReqItems([]); }
  };
  async function screen() {
    setScreening(true);
    const r = await aiScreenBuddy(b.id);
    if (r.text) setNotes((n: string) => (n ? n + "\n\n--- AI screening ---\n" : "") + r.text);
    setScreening(false);
  }
  const gs = Array.isArray(b.guarantors) ? b.guarantors : [];
  const nok = b.next_of_kin ?? {};

  return (
    <div className="mt-4 grid gap-4 border-t border-bbb-border pt-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1.5 rounded-2xl bg-bbb-bg p-4">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Application</p>
          <Row label="Date of birth" value={b.date_of_birth} />
          <Row label="NIN" value={b.nin} />
          <Row label="Address" value={b.address} />
          <Row label="State / LGA" value={[b.state, b.lga].filter(Boolean).join(" / ")} />
          <Row label="City" value={b.city} />
          <Row label="Coverage" value={b.coverage_areas} />
          <Row label="Occupation" value={b.occupation} />
          <Row label="Education" value={[b.education_level, b.course_of_study].filter(Boolean).join(" — ")} />
          <Row label="School" value={[b.school_attended, b.year_of_graduation].filter(Boolean).join(", ")} />
          <Row label="Availability" value={b.availability?.replace(/_/g, " ")} />
          <Row label="Smartphone" value={b.has_smartphone ? "Yes" : "No"} />
          <Row label="Can ride/drive" value={`${b.can_drive ? "Yes" : "No"}${b.has_drivers_license ? " (licensed)" : ""}`} />
          <Row label="Criminal record" value={b.criminal_record === null || b.criminal_record === undefined ? "—" : b.criminal_record ? `Declared: ${b.criminal_record_details ?? ""}` : "None declared"} />
          {b.experience && <p className="pt-1 text-sm text-bbb-charcoal"><span className="text-bbb-slate">Experience:</span> {b.experience}</p>}
        </div>
        <div className="space-y-1.5 rounded-2xl bg-bbb-bg p-4">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Documents</p>
          <div className="flex flex-wrap gap-2">
            <DocLink label={`ID${b.id_doc_type ? ` (${b.id_doc_type.replace(/_/g, " ")})` : ""}`} url={b.id_doc_url} />
            <DocLink label="Utility bill" url={b.utility_bill_url} />
            <DocLink label="PCC" url={b.pcc_url} />
          </div>
          <p className="pt-1 text-[11px] text-bbb-slate">Links are private and expire after 1 hour.</p>
        </div>
        <div className="space-y-3 rounded-2xl bg-bbb-bg p-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Guarantors &amp; next of kin</p>
          {gs.length === 0 && <p className="text-sm text-bbb-slate">No guarantors provided yet.</p>}
          {gs.map((g: any, i: number) => (
            <div key={i} className="space-y-1 rounded-xl border border-bbb-border bg-white p-3">
              <p className="text-sm font-bold">{i + 1}. {g.name} <span className="font-normal text-bbb-slate">· {g.occupation}</span></p>
              <p className="text-xs text-bbb-slate">{g.phone} · {g.relationship} · {g.address}</p>
            </div>
          ))}
          <Row label="Next of kin" value={nok?.name ? `${nok.name} (${nok.relationship}) · ${nok.phone}` : undefined} />
          <Row label="Payout account" value={b.bank_account_number ? `${b.bank_name ?? ""} ${b.bank_account_number} · ${b.bank_account_name ?? "no name"}` : undefined} />
          {b.bank_account_name && b.profiles?.full_name && b.bank_account_name.toLowerCase().trim() !== b.profiles.full_name.toLowerCase().trim() && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">⚠ Bank account name doesn&apos;t match legal name — verify before payout.</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-bbb-bg p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Vetting checklist</p>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${allDone ? "bg-green-100 text-green-700" : "bg-white text-bbb-slate"}`}>{doneCount}/{VETTING_CHECKS.length}</span>
          </div>
          <div className="space-y-2">
            {VETTING_CHECKS.map(([key, label]) => (
              key === "nda_signed" ? (
                <div key={key} className="flex items-start gap-2.5 text-sm leading-5">
                  <input type="checkbox" checked={Boolean(b.nda_signed_at)} disabled readOnly className="mt-0.5 h-4 w-4 rounded border-bbb-border accent-[#079516]" />
                  <span className={b.nda_signed_at ? "text-bbb-charcoal" : "text-bbb-slate"}>
                    {label}
                    {b.nda_signed_at
                      ? <em className="ml-1 not-italic text-xs text-green-700">— signed by {b.nda_signed_name} on {new Date(b.nda_signed_at).toLocaleDateString()}</em>
                      : <em className="ml-1 not-italic text-xs text-amber-600">— awaiting buddy's signature in their portal</em>}
                  </span>
                </div>
              ) : (
              <label key={key} className="flex items-start gap-2.5 text-sm leading-5">
                <input
                  type="checkbox"
                  checked={Boolean(checks[key])}
                  disabled={pending}
                  onChange={(e) => run(() => updateVettingCheck(b.id, key, e.target.checked))}
                  className="mt-0.5 h-4 w-4 rounded border-bbb-border accent-[#079516]"
                />
                <span className={checks[key] ? "text-bbb-charcoal" : "text-bbb-slate"}>{label}</span>
              </label>
              )
            ))}
          </div>
          {!allDone && b.vetting !== "approved" && (
            <p className="mt-3 rounded-lg bg-white p-2 text-xs text-bbb-slate">Approval unlocks when all checks are ticked.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionBusy === "nda" || Boolean(b.nda_signed_at)}
              onClick={() => sendAction("nda")}
              className="rounded-lg border border-bbb-strong px-3 py-1.5 text-xs font-bold text-bbb-strong hover:bg-bbb-bg disabled:opacity-50"
            >{b.nda_signed_at ? "NDA already signed ✓" : actionBusy === "nda" ? "Sending…" : "Email: sign NDA"}</button>
            <button
              type="button"
              disabled={actionBusy === "guarantors"}
              onClick={() => sendAction("guarantors")}
              className="rounded-lg border border-bbb-strong px-3 py-1.5 text-xs font-bold text-bbb-strong hover:bg-bbb-bg disabled:opacity-50"
            >{actionBusy === "guarantors" ? "Sending…" : "Email: request guarantor details"}</button>
          </div>
          {actionMsg && <p className={`mt-2 text-xs font-semibold ${actionMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{actionMsg}</p>}
        </div>

        <div className="rounded-2xl bg-bbb-bg p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Request documents by email</p>
            <button
              type="button"
              onClick={() => setReqItems(reqItems.length === REQUESTABLE_ITEMS.length ? [] : REQUESTABLE_ITEMS.map(([k]) => k))}
              className="text-xs font-bold text-bbb-strong hover:text-bbb-dark"
            >{reqItems.length === REQUESTABLE_ITEMS.length ? "Clear all" : "Select all"}</button>
          </div>
          <p className="mb-2 text-xs text-bbb-slate">Tick what you need, then email the buddy asking them to reply with these items.</p>
          <div className="space-y-2">
            {REQUESTABLE_ITEMS.map(([key, label]) => (
              <label key={key} className="flex items-start gap-2.5 text-sm leading-5">
                <input
                  type="checkbox"
                  checked={reqItems.includes(key)}
                  disabled={reqSending}
                  onChange={() => toggleReq(key)}
                  className="mt-0.5 h-4 w-4 rounded border-bbb-border accent-[#079516]"
                />
                <span className={reqItems.includes(key) ? "text-bbb-charcoal" : "text-bbb-slate"}>{label}</span>
              </label>
            ))}
          </div>
          <button
            disabled={reqSending || reqItems.length === 0}
            onClick={sendRequest}
            className="mt-3 w-full rounded-xl bg-bbb-strong px-3 py-2 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
          >{reqSending ? "Sending…" : `Request ${reqItems.length || ""} selected item${reqItems.length === 1 ? "" : "s"} by email`}</button>
          {reqMsg && <p className={`mt-2 text-xs font-semibold ${reqMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{reqMsg}</p>}
        </div>
        <div className="rounded-2xl bg-bbb-bg p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Vetting notes</p>
            <button disabled={screening || pending} onClick={screen} className="rounded-lg border border-bbb-border px-3 py-1 text-xs font-bold text-bbb-strong hover:border-bbb-strong disabled:opacity-50">{screening ? "Screening…" : "✦ AI screening notes"}</button>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Interview impressions, guarantor call summaries, anything future-you should know…" className="w-full rounded-xl border border-bbb-border bg-white p-3 text-sm outline-none focus:border-bbb-strong" />
          <button disabled={pending} onClick={() => run(() => saveVettingNotes(b.id, notes))} className="mt-2 rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Save notes</button>
        </div>
        <div className="mt-3 border-t border-bbb-border pt-3">
          <DeleteButton
            label="Delete this buddy"
            confirmText={`Delete ${b.full_name || "this buddy"} permanently?`}
            requireTyping
            action={() => deleteUser(b.id)}
          />
        </div>
      </div>
    </div>
  );
}

export default function BuddyManagement({ buddies, missing }: { buddies: any[]; missing: any[] }) {
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<BuddyFilterValue>(EMPTY_BUDDY_FILTER);
  const states = useMemo(() => Array.from(new Set(buddies.map((b: any) => b.state).filter(Boolean))).sort(), [buddies]);
  const filtered = useMemo(() => applyBuddyFilters(buddies, filter, { showVetting: true }), [buddies, filter]);
  const run = (fn: () => Promise<{ error: string }>) => start(async () => { setError(""); const r = await fn(); if (r?.error) setError(r.error); });

  return (
    <AdminShell title="Buddy Management">
      <PageHeader eyebrow="People" title="Buddy Management" description="Vet applications with the full checklist — ID, NIN, address, guarantors, PCC, interview, training. Approval unlocks only when every check is done." />
      {error && <div className="mb-4"><ErrorState title="Action failed" message={error} /></div>}

      {missing.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">Accounts with buddy role but no buddy profile:</p>
          {missing.map((m: any) => (
            <div key={m.id} className="mt-2 flex items-center justify-between text-sm">
              <span>{m.full_name ?? m.email}</span>
              <button disabled={pending} onClick={() => run(() => createBuddyProfileRow(m.id))} className="rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Create profile</button>
            </div>
          ))}
        </div>
      )}

      {buddies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No buddy applications yet.</div>
      ) : (
        <>
          <BuddyFilterBar states={states} value={filter} onChange={setFilter} showVetting />
          <p className="mb-3 text-xs text-bbb-slate">{filtered.length} of {buddies.length} buddies</p>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No buddies match these filters.</div>
          ) : (
          <div className="space-y-3">
          {filtered.map((b: any) => {
            const checks = (b.vetting_checks ?? {}) as Record<string, boolean>;
            const doneCount = VETTING_CHECKS.filter(([k]) => checks[k]).length;
            const isOpen = open === b.id;
            return (
              <article key={b.id} className="rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button onClick={() => setOpen(isOpen ? null : b.id)} className="flex min-w-0 items-center gap-2 text-left">
                    {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-bbb-slate" /> : <ChevronDown className="h-4 w-4 shrink-0 text-bbb-slate" />}
                    <span className="min-w-0">
                      <span className="block font-semibold">{b.profiles?.full_name ?? b.profiles?.email}</span>
                      <span className="block text-xs text-bbb-slate">{b.profiles?.email} · {b.profiles?.phone ?? "—"} · {[b.city, b.state].filter(Boolean).join(", ") || "location —"} · checks {doneCount}/{VETTING_CHECKS.length}</span>
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <StatusPill status={statusLabel(b.vetting)} />
                    {b.vetting !== "approved" && <button disabled={pending} onClick={() => run(() => setBuddyVetting(b.id, "approved"))} className="rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Approve</button>}
                    {b.vetting === "approved" && <button disabled={pending} onClick={() => run(() => setBuddyVetting(b.id, "suspended"))} className="rounded-lg border border-bbb-border px-3 py-1.5 text-xs font-bold hover:border-red-300 hover:text-red-600 disabled:opacity-50">Suspend</button>}
                    {["applied", "under_review"].includes(b.vetting) && <button disabled={pending} onClick={() => run(() => setBuddyVetting(b.id, "rejected"))} className="rounded-lg border border-bbb-border px-3 py-1.5 text-xs font-bold hover:border-red-300 hover:text-red-600 disabled:opacity-50">Reject</button>}
                  </div>
                </div>
                {isOpen && <BuddyDetail b={b} pending={pending} run={run} />}
              </article>
            );
          })}
          </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
