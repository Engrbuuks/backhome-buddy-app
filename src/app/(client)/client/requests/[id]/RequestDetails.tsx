"use client";
import React from "react";
import { Camera, FileText, Video } from "lucide-react";
import { StatusPill, statusLabel } from "@/components/StatusPill";
import { RequestMessages } from "@/components/RequestMessages";
import { formatClientMoneyIn, formatDate } from "@/components/money";
import { useState, useTransition } from "react";
import { confirmCompletion } from "@/lib/requests/confirm-actions";
import ClientCharges from "./ClientCharges";
import QuoteResponse from "./QuoteResponse";
import { cancelRequest, raiseDispute } from "@/lib/money/edge-actions";
import { ProofMedia } from "@/components/ProofMedia";
import { useFormState } from "react-dom";
import { ErrorState } from "@/components/StateBlocks";

const LIFECYCLE = ["submitted", "quoted", "paid", "assigned", "in_progress", "proof_ready", "proof_approved", "completed"] as const;
const PROOF_ICON = { photo: Camera, video: Video, report: FileText } as const;

export default function RequestDetails({ request, charges = [], currency = "USD", rates, bank }: { request: any; charges?: any[]; currency?: any; rates?: any; bank?: any }) {
  const [confirmError, setConfirmError] = useState("");
  const [confirming, startConfirm] = useTransition();
  const [cancelError, setCancelError] = useState("");
  const [cancelling, startCancel] = useTransition();
  const [showIssue, setShowIssue] = useState(false);
  const [issueState, issueAction] = useFormState(raiseDispute, { error: "" });
  const CANCELLABLE = ["draft", "submitted", "quoted", "paid"];
  const DISPUTABLE = ["in_progress", "proof_ready", "proof_approved", "completed"];
  const reached = LIFECYCLE.indexOf(request.status) >= 0 ? LIFECYCLE.indexOf(request.status) : -1;
  const total = (request.quote_items ?? []).reduce((s: number, q: any) => s + Number(q.amount_ngn || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-strong">Request</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold">{request.title}</h1>
        <p className="mt-1 text-sm text-bbb-slate">{request.service_types?.name ?? "Custom"} · {formatDate(request.created_at)}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="space-y-5">
          <QuoteResponse request={request} />
          <ClientCharges charges={charges} />
          {request.report && (
            <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
              <h2 className="font-display text-lg font-extrabold">Completion report</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-bbb-charcoal">{request.report}</p>
            </div>
          )}
          <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
            <div className="flex flex-wrap gap-2"><StatusPill status={request.status} /></div>
            {request.description && <p className="mt-4 text-sm leading-7 text-bbb-slate">{request.description}</p>}
          </div>

          <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold">Lifecycle timeline</h2>
            <div className="mt-5 space-y-3">
              {LIFECYCLE.map((s, i) => (
                <div key={s} className="flex items-center gap-3">
                  <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i <= reached ? "bg-bbb-strong text-white" : "bg-bbb-bg text-bbb-slate"}`}>{i + 1}</div>
                  <span className={`text-sm font-semibold ${i <= reached ? "text-bbb-charcoal" : "text-bbb-slate"}`}>{statusLabel(s)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold">Proof gallery</h2>
            <ProofMedia proofs={request.proofs ?? []} />
            {(request.proofs ?? []).length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {request.proofs.filter((p: any) => p.kind === "report").map((p: any) => {
                  const Icon = PROOF_ICON[p.kind as keyof typeof PROOF_ICON] ?? FileText;
                  return (
                    <div key={p.id} className="rounded-2xl bg-bbb-bg p-4">
                      <Icon className="h-6 w-6 text-bbb-strong" />
                      <p className="mt-3 text-sm font-bold capitalize">{p.kind}</p>
                      {p.note && <p className="mt-1 text-xs text-bbb-slate">{p.note}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-bbb-slate">Proof will appear here after your buddy submits it and our team reviews it.</p>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold">Quote</h2>
            {(request.quote_items ?? []).length > 0 ? (
              <>
                <div className="mt-4 space-y-2">
                  {request.quote_items.map((q: any) => (
                    <div key={q.id} className="flex items-center justify-between text-sm">
                      <span className="text-bbb-slate">{q.label}</span>
                      <span className="font-semibold">{formatClientMoneyIn(Number(q.amount_ngn), currency, rates)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-bbb-border pt-3">
                  <span className="text-sm font-bold">Total</span>
                  <span className="font-display text-lg font-extrabold">{formatClientMoneyIn(request.client_price_ngn ?? total, currency, rates)}</span>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-bbb-slate">We&apos;re reviewing your request — your quote will appear here.</p>
            )}
            {request.status === "quoted" ? (
              <div className="mt-4 rounded-xl bg-bbb-soft p-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-dark">Payment details</p>
                {bank ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-bbb-slate">Pay <span className="font-bold text-bbb-charcoal">{formatClientMoneyIn(request.client_price_ngn ?? total, currency, rates)}</span> by transfer to:</p>
                    <div className="mt-2 rounded-lg border border-bbb-border bg-white p-3">
                      {bank.bank_name && <p className="flex justify-between"><span className="text-bbb-slate">Bank</span><span className="font-semibold">{bank.bank_name}</span></p>}
                      {bank.account_name && <p className="flex justify-between"><span className="text-bbb-slate">Account name</span><span className="font-semibold">{bank.account_name}</span></p>}
                      {bank.account_number && <p className="flex justify-between"><span className="text-bbb-slate">Account number</span><span className="font-mono font-bold">{bank.account_number}</span></p>}
                      {bank.extra && <p className="flex justify-between"><span className="text-bbb-slate">Sort/SWIFT/Routing</span><span className="font-semibold">{bank.extra}</span></p>}
                    </div>
                    <p className="mt-2 text-[11px] text-bbb-slate">Use your request title as the transfer reference. We&apos;ll confirm receipt here once it lands.</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-bbb-dark">To pay: send the amount via transfer as advised by our team — we&apos;ll confirm receipt here once it lands.</p>
                )}
              </div>
            ) : null}
            {request.status === "proof_approved" && (
              <div className="mt-4">
                {confirmError && <div className="mb-2"><ErrorState title="Could not confirm" message={confirmError} /></div>}
                <button disabled={confirming} onClick={() => startConfirm(async () => { setConfirmError(""); const r = await confirmCompletion(request.id); if (r?.error) setConfirmError(r.error); })} className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Confirm completion</button>
                <p className="mt-2 text-[11px] text-bbb-slate">Confirming releases your buddy&apos;s payout for processing.</p>
              </div>
            )}
          </div>

          {(CANCELLABLE.includes(request.status) || DISPUTABLE.includes(request.status)) && (
            <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
              <h2 className="font-display text-lg font-extrabold">Need help?</h2>
              {cancelError && <div className="mt-3"><ErrorState title="Could not cancel" message={cancelError} /></div>}
              {CANCELLABLE.includes(request.status) && (
                <div className="mt-3">
                  <button disabled={cancelling} onClick={() => { if (!window.confirm(request.status === "paid" ? "Cancel this request? Your payment will be refunded." : "Cancel this request?")) return; startCancel(async () => { setCancelError(""); const r = await cancelRequest(request.id); if (r?.error) setCancelError(r.error); }); }} className="h-11 w-full rounded-xl border border-bbb-border text-sm font-bold text-bbb-slate hover:border-red-300 hover:text-red-600 disabled:opacity-50">Cancel request</button>
                  {request.status === "paid" && <p className="mt-2 text-[11px] text-bbb-slate">You&apos;ve already paid — cancelling sends this to our team for a refund.</p>}
                </div>
              )}
              {DISPUTABLE.includes(request.status) && (
                <div className="mt-3">
                  {!showIssue ? (
                    <button onClick={() => setShowIssue(true)} className="h-11 w-full rounded-xl border border-bbb-border text-sm font-bold text-bbb-slate hover:border-amber-300 hover:text-amber-700">Raise an issue</button>
                  ) : (
                    <form action={issueAction} className="space-y-3">
                      {issueState?.error && <ErrorState title="Could not submit" message={issueState.error} />}
                      {(issueState as any)?.saved && <div className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">Issue raised — our team will review and get back to you.</div>}
                      <input type="hidden" name="request_id" value={request.id} />
                      <textarea name="reason" required placeholder="Tell us what went wrong..." className="min-h-[100px] w-full rounded-xl border border-bbb-border p-3 text-sm outline-none focus:border-bbb-strong" />
                      <button className="h-11 w-full rounded-xl bg-amber-500 text-sm font-bold text-white hover:bg-amber-600">Submit issue</button>
                    </form>
                  )}
                  <p className="mt-2 text-[11px] text-bbb-slate">Raising an issue pauses the request while we investigate.</p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold">Recipient</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-bbb-slate">Name</dt><dd className="font-semibold">{request.recipient_name || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-bbb-slate">Phone</dt><dd className="font-semibold">{request.recipient_phone || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-bbb-slate">Address</dt><dd className="font-semibold text-right">{request.recipient_address || "—"}</dd></div>
            </dl>
          </div>

          <RequestMessages requestId={request.id} viewer="client" />
        </aside>
      </div>
    </div>
  );
}
