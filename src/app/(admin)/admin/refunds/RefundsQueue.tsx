"use client";
/**
 * Refunds, cancellations and the rules behind them, on one screen.
 *
 * Four sections, in the order the money actually moves:
 *   1. Requests awaiting a decision — the client has asked, nobody has ruled.
 *   2. Approved, awaiting transfer — ruled on, money still in your account.
 *   3. Cancelled requests still holding funds — the older route, kept working.
 *   4. The policy itself, editable, because the numbers are a business
 *      decision and should not need a deployment to change.
 *
 * The retention figure recalculates in the browser as the fault is changed,
 * using the same pure function the server uses. The server recomputes it again
 * before writing, so what is shown here is a preview, never the authority.
 */
import React, { useMemo, useState, useTransition } from "react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ErrorState } from "@/components/StateBlocks";
import { formatNGN, formatDate } from "@/components/money";
import { recordManualRefund } from "@/lib/money/edge-actions";
import { decideRefundRequest, saveRefundPolicy } from "@/lib/money/refund-actions";
import {
  computeRetention, stageLabel, FAULT_LABELS, REFUND_REASONS,
  type Fault, type RefundPolicy,
} from "@/lib/money/refund-policy";

const REASON_LABEL = Object.fromEntries(REFUND_REASONS.map(([k, v]) => [k, v]));
const STAGE_ORDER = ["paid", "assigned", "in_progress", "proof_ready", "proof_approved", "completed"];

export default function RefundsQueue({
  legacy = [], requests = [], awaitingTransfer = [], migrationMissing = false, policy,
}: {
  legacy?: any[];
  requests?: any[];
  awaitingTransfer?: any[];
  migrationMissing?: boolean;
  policy: RefundPolicy;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <AdminShell title="Refunds & Cancellations">
      <PageHeader
        eyebrow="Money back"
        title="Refunds & Cancellations"
        description="Decide refund requests, then transfer the money and record it. Approving is a decision; sending is a separate act, and the client is only told the money is on its way once you have actually sent it."
      />

      {error && <div className="mb-4"><ErrorState title="That did not go through" message={error} /></div>}

      {migrationMissing && (
        <section className="mb-5 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
          <h2 className="font-display text-base font-extrabold text-amber-900">Refund requests are not installed yet</h2>
          <p className="mt-1 text-sm text-amber-800">
            Run <strong>supabase/migrations/0042_refund_requests.sql</strong> in Supabase. Until then clients cannot
            ask for a refund in the portal, and the older cancel route below is the only one working.
          </p>
        </section>
      )}

      {/* 1 ------------------------------------------------ decisions */}
      <h2 className="mb-2 font-display text-lg font-extrabold">
        Awaiting your decision {requests.length > 0 && <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-extrabold text-red-700">{requests.length}</span>}
      </h2>
      {requests.length === 0 ? (
        <p className="mb-6 rounded-2xl border border-dashed border-bbb-border bg-white p-6 text-center text-sm text-bbb-slate">
          No refund requests waiting.
        </p>
      ) : (
        <div className="mb-8 space-y-3">
          {requests.map((rr) => (
            <DecisionCard key={rr.id} rr={rr} policy={policy} onError={setError} />
          ))}
        </div>
      )}

      {/* 2 ------------------------------------------- awaiting money */}
      <h2 className="mb-2 font-display text-lg font-extrabold">
        Approved — transfer the money, then record it {awaitingTransfer.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800">{awaitingTransfer.length}</span>}
      </h2>
      {awaitingTransfer.length === 0 ? (
        <p className="mb-6 rounded-2xl border border-dashed border-bbb-border bg-white p-6 text-center text-sm text-bbb-slate">
          Nothing approved is waiting on a transfer.
        </p>
      ) : (
        <div className="mb-8 space-y-3">
          {awaitingTransfer.map((rr) => (
            <article key={rr.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{rr.requests?.title ?? "—"}</p>
                  <p className="text-xs text-bbb-slate">
                    {rr.profiles?.full_name ?? "—"} · approved {formatDate(rr.decided_at)}
                    {rr.auto_approved && " · automatic"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-display font-extrabold text-green-700">{formatNGN(Number(rr.refunded_ngn ?? 0))}</p>
                    {Number(rr.retained_ngn ?? 0) > 0 && (
                      <p className="text-[11px] text-amber-800">{formatNGN(Number(rr.retained_ngn))} retained</p>
                    )}
                  </div>
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Confirm you have transferred ${formatNGN(Number(rr.refunded_ngn ?? 0))} to the client.`)) return;
                      start(async () => {
                        setError("");
                        const res = await recordManualRefund(rr.request_id, Number(rr.refunded_ngn ?? 0));
                        if (res?.error) setError(res.error);
                      });
                    }}
                    className="h-10 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
                  >
                    Record refund sent
                  </button>
                </div>
              </div>
              {Number(rr.retained_ngn ?? 0) > 0 && rr.requests?.assigned_buddy_id && (
                <p className="mt-2 rounded-xl bg-white/70 p-2.5 text-[11px] leading-5 text-bbb-slate">
                  A buddy was assigned to this task. The {formatNGN(Number(rr.retained_ngn))} retained is not paid to
                  them automatically — if they are owed something for work already done, pay it from the Payouts screen.
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* 3 --------------------------------------- the older route */}
      <h2 className="mb-2 font-display text-lg font-extrabold">Cancelled requests still holding funds</h2>
      {legacy.length === 0 ? (
        <p className="mb-8 rounded-2xl border border-dashed border-bbb-border bg-white p-6 text-center text-sm text-bbb-slate">
          Nothing here.
        </p>
      ) : (
        <div className="mb-8 space-y-3">
          {legacy.map((r) => (
            <article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="text-xs text-bbb-slate">{r.profiles?.full_name ?? "—"} · cancelled {formatDate(r.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-extrabold">{formatNGN(Number(r.client_price_ngn ?? 0))}</span>
                <button
                  disabled={pending}
                  onClick={() => start(async () => { setError(""); const res = await recordManualRefund(r.id); if (res?.error) setError(res.error); })}
                  className="h-10 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
                >
                  Record refund sent
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* 4 ------------------------------------------------- policy */}
      <PolicyEditor policy={policy} onError={setError} />
    </AdminShell>
  );
}

/* ------------------------------------------------------------------ */

function DecisionCard({ rr, policy, onError }: { rr: any; policy: RefundPolicy; onError: (s: string) => void }) {
  const [fault, setFault] = useState<Fault | "">("");
  const [note, setNote] = useState("");
  const [override, setOverride] = useState<string>("");
  const [pending, start] = useTransition();

  // The task may have moved on since the client asked. Decide against where it
  // is now, not where it was, and show both so the difference is visible.
  const liveStatus: string = rr.requests?.status ?? rr.request_status_at_request;
  const paid = Number(rr.paid_ngn ?? rr.requests?.client_price_ngn ?? 0);
  const moved = liveStatus !== rr.request_status_at_request;

  const computed = useMemo(
    () => computeRetention(liveStatus, paid, policy, (fault || null) as Fault | null),
    [liveStatus, paid, policy, fault],
  );

  const effectiveRefund = override !== "" && Number.isFinite(Number(override))
    ? Math.max(0, Math.min(Number(override), paid))
    : computed.refundable_ngn;
  const effectiveRetained = Math.round((paid - effectiveRefund) * 100) / 100;
  const overriding = override !== "" && Math.abs(effectiveRefund - computed.refundable_ngn) > 0.005;

  return (
    <article className="rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{rr.requests?.title ?? "—"}</p>
          <p className="text-xs text-bbb-slate">
            {rr.profiles?.full_name ?? "—"} · asked {formatDate(rr.created_at)} · stage {stageLabel(liveStatus)}
          </p>
        </div>
        <span className="rounded-full bg-bbb-bg px-2.5 py-1 text-[11px] font-bold uppercase text-bbb-slate">
          {REASON_LABEL[rr.reason_code] ?? rr.reason_code}
        </span>
      </div>

      <p className="mt-3 rounded-xl bg-bbb-bg p-3 text-sm leading-6 text-bbb-charcoal">&ldquo;{rr.reason}&rdquo;</p>

      {moved && (
        <p className="mt-2 text-[11px] text-amber-800">
          The task has moved from &ldquo;{stageLabel(rr.request_status_at_request)}&rdquo; to &ldquo;{stageLabel(liveStatus)}&rdquo; since they asked. The figures below use where it is now.
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Whose fault was it?</span>
          <select
            value={fault}
            onChange={(e) => setFault(e.target.value as Fault | "")}
            className="mt-1 h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong"
          >
            <option value="">Not decided</option>
            {(Object.keys(FAULT_LABELS) as Fault[]).map((f) => (
              <option key={f} value={f}>{FAULT_LABELS[f]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Refund amount (₦)</span>
          <input
            type="number" min={0} max={paid} step="0.01"
            value={override}
            placeholder={String(Math.round(computed.refundable_ngn))}
            onChange={(e) => setOverride(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong"
          />
        </label>
      </div>

      <dl className="mt-3 space-y-1 rounded-2xl bg-bbb-bg p-3 text-sm">
        <div className="flex justify-between"><dt className="text-bbb-slate">Paid</dt><dd className="font-semibold">{formatNGN(paid)}</dd></div>
        <div className="flex justify-between"><dt className="text-bbb-slate">Refund to client</dt><dd className="font-display font-extrabold text-green-700">{formatNGN(effectiveRefund)}</dd></div>
        <div className="flex justify-between"><dt className="text-bbb-slate">Retained</dt><dd className="font-semibold text-amber-700">{formatNGN(effectiveRetained)}</dd></div>
      </dl>
      <p className="mt-1.5 text-[11px] leading-5 text-bbb-slate">{computed.basis}</p>
      {overriding && (
        <p className="mt-1 text-[11px] font-bold text-amber-800">
          You are overriding the policy figure of {formatNGN(computed.refundable_ngn)}. Both numbers are stored.
        </p>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What should the client be told? Required for a decline."
        className="mt-3 min-h-[70px] w-full rounded-xl border border-bbb-border p-3 text-sm outline-none focus:border-bbb-strong"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Approve a refund of ${formatNGN(effectiveRefund)}? The money is not sent yet — you will still need to transfer it.`)) return;
            start(async () => {
              onError("");
              const res = await decideRefundRequest(rr.id, "approve", {
                fault: (fault || null) as Fault | null,
                amountOverride: override === "" ? null : Number(override),
                note,
              });
              if (res?.error) onError(res.error);
            });
          }}
          className="h-11 flex-1 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
        >
          Approve {formatNGN(effectiveRefund)}
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (!note.trim()) { onError("Give the client a reason before declining."); return; }
            if (!window.confirm("Decline this refund request?")) return;
            start(async () => {
              onError("");
              const res = await decideRefundRequest(rr.id, "decline", { fault: (fault || null) as Fault | null, note });
              if (res?.error) onError(res.error);
            });
          }}
          className="h-11 rounded-xl border border-bbb-border px-4 text-sm font-bold text-bbb-slate hover:border-red-300 hover:text-red-600 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

function PolicyEditor({ policy, onError }: { policy: RefundPolicy; onError: (s: string) => void }) {
  const [draft, setDraft] = useState<RefundPolicy>(policy);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const setStage = (key: string, field: "pct" | "floor_ngn", value: string) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      stages: { ...d.stages, [key]: { ...(d.stages[key] ?? { pct: 0, floor_ngn: 0 }), [field]: Number(value) || 0 } },
    }));
  };

  return (
    <section className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <h2 className="font-display text-lg font-extrabold">The non refundable amount</h2>
      <p className="mt-1 text-sm text-bbb-slate">
        What is kept when a client pulls out and the failure is not yours. Nothing is ever retained before a buddy is
        assigned, and nothing is retained when the fault is yours or the buddy&apos;s — those two rules are fixed in
        code, not here. Clients see these figures before they press the button.
      </p>

      <div className="mt-4 space-y-2">
        {STAGE_ORDER.map((key) => {
          const rule = draft.stages[key] ?? { pct: 0, floor_ngn: 0 };
          const locked = key === "paid";
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 rounded-xl bg-bbb-bg p-3">
              <span className="w-40 text-sm font-semibold capitalize">{stageLabel(key)}</span>
              <label className="flex items-center gap-2 text-xs text-bbb-slate">
                keep
                <input
                  type="number" min={0} max={100} value={rule.pct} disabled={locked}
                  onChange={(e) => setStage(key, "pct", e.target.value)}
                  className="h-9 w-20 rounded-lg border border-bbb-border px-2 text-sm disabled:bg-white/50 disabled:text-bbb-slate"
                />
                %
              </label>
              <label className="flex items-center gap-2 text-xs text-bbb-slate">
                or at least ₦
                <input
                  type="number" min={0} value={rule.floor_ngn} disabled={locked}
                  onChange={(e) => setStage(key, "floor_ngn", e.target.value)}
                  className="h-9 w-28 rounded-lg border border-bbb-border px-2 text-sm disabled:bg-white/50 disabled:text-bbb-slate"
                />
              </label>
              {locked && <span className="text-[11px] text-bbb-slate">fixed at zero — no buddy has committed yet</span>}
            </div>
          );
        })}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox" checked={draft.auto_approve_unassigned}
          onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, auto_approve_unassigned: e.target.checked })); }}
          className="h-4 w-4"
        />
        Approve automatically when no buddy was ever assigned
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox" checked={draft.enabled}
          onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, enabled: e.target.checked })); }}
          className="h-4 w-4"
        />
        Let clients request refunds from the portal
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={pending}
          onClick={() => start(async () => {
            onError(""); setSaved(false);
            const res = await saveRefundPolicy(draft);
            if (res?.error) onError(res.error); else setSaved(true);
          })}
          className="h-11 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
        >
          Save the policy
        </button>
        {saved && <span className="text-sm font-bold text-green-700">Saved</span>}
      </div>
    </section>
  );
}
