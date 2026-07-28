"use client";
import React, { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Star, Copy, Check, Loader2, Link2, ThumbsUp, ThumbsDown } from "lucide-react";
import { createTestimonialInvite, moderateTestimonial } from "@/lib/testimonials/actions";
import { locationByCode } from "@/lib/testimonials/locations";

export default function TestimonialsAdmin({ pending, approved, invites }: { pending: any[]; approved: any[]; invites: any[] }) {
  const [state, action] = useFormState(createTestimonialInvite, { error: "" } as any);
  const [copied, setCopied] = useState<string | null>(null);
  const router = useRouter();

  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000); } catch {}
  };

  return (
    <div className="space-y-8">
      {/* Generate a link */}
      <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        <p className="mb-3 font-display text-base font-extrabold">Generate a testimonial link</p>
        <form action={action} className="grid gap-3 sm:grid-cols-2">
          <input name="invitee_name" required placeholder="Who is this for? (name)" className="h-11 rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong" />
          <input name="invitee_email" type="email" placeholder="Their email (optional)" className="h-11 rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong" />
          <input name="note" placeholder="Note / context (optional)" className="h-11 rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong sm:col-span-2" />
          <button className="h-11 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark sm:col-span-2"><Link2 className="mr-1 inline h-4 w-4" /> Generate one-time link</button>
        </form>
        {state?.error && <p className="mt-2 text-sm font-semibold text-red-600">{state.error}</p>}
        {state?.link && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
            <input readOnly value={state.link} className="flex-1 bg-transparent text-xs text-green-900 outline-none" />
            <button onClick={() => copy(state.link, "new")} className="inline-flex items-center gap-1 rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white">
              {copied === "new" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied === "new" ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        {invites.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-bold text-bbb-slate">Recent links ({invites.length})</summary>
            <div className="mt-2 space-y-1">
              {invites.map((i) => {
                const url = `${typeof window !== "undefined" ? window.location.origin : ""}/testimonial/${i.token}`;
                return (
                  <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg border border-bbb-border px-3 py-2 text-xs">
                    <span className="font-semibold">{i.invitee_name}</span>
                    <span className={i.used ? "text-bbb-slate" : "text-green-600 font-bold"}>{i.used ? "Used" : "Unused"}</span>
                    {!i.used && <button onClick={() => copy(url, i.id)} className="rounded bg-bbb-bg px-2 py-1 font-bold text-bbb-strong">{copied === i.id ? "Copied" : "Copy"}</button>}
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      {/* Pending review */}
      <div>
        <h2 className="mb-3 font-display text-lg font-extrabold">Awaiting approval ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-6 text-center text-sm text-bbb-slate">Nothing waiting for review.</div>
        ) : (
          <div className="space-y-3">{pending.map((t) => <Card key={t.id} t={t} moderate />)}</div>
        )}
      </div>

      {/* Approved (live on site) */}
      <div>
        <h2 className="mb-3 font-display text-lg font-extrabold">Live on the website ({approved.length})</h2>
        {approved.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-6 text-center text-sm text-bbb-slate">No approved testimonials yet.</div>
        ) : (
          <div className="space-y-3">{approved.map((t) => <Card key={t.id} t={t} unpublish />)}</div>
        )}
      </div>
    </div>
  );

  function Card({ t, moderate, unpublish }: { t: any; moderate?: boolean; unpublish?: boolean }) {
    const [pending, start] = useTransition();
    const loc = locationByCode(t.location_code);
    const act = (decision: "approved" | "rejected") => start(async () => { await moderateTestimonial(t.id, decision); router.refresh(); });
    return (
      <div className="rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-bbb-charcoal">{t.author_name} {loc && <span className="text-sm font-normal text-bbb-slate">· {loc.flag} {loc.label}</span>}</p>
            <div className="mt-0.5 flex gap-0.5">{[1,2,3,4,5].map((n) => <Star key={n} className={`h-4 w-4 ${t.rating >= n ? "fill-yellow-400 text-yellow-400" : "text-bbb-border"}`} />)}</div>
          </div>
          <span className="text-xs text-bbb-slate">{new Date(t.created_at).toLocaleDateString("en-GB")}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-bbb-charcoal">{t.body}</p>
        {t.media_signed && (
          t.media_kind === "video"
            ? <video src={t.media_signed} controls className="mt-2 max-h-52 rounded-lg" />
            : <img src={t.media_signed} alt="" className="mt-2 max-h-52 rounded-lg object-cover" />
        )}
        <div className="mt-3 flex gap-2">
          {moderate && <>
            <button disabled={pending} onClick={() => act("approved")} className="inline-flex items-center gap-1.5 rounded-lg bg-bbb-strong px-4 py-2 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />} Approve — show on site</button>
            <button disabled={pending} onClick={() => act("rejected")} className="inline-flex items-center gap-1.5 rounded-lg border border-bbb-border px-4 py-2 text-xs font-bold text-bbb-slate hover:border-red-300 hover:text-red-600 disabled:opacity-50"><ThumbsDown className="h-3.5 w-3.5" /> Reject</button>
          </>}
          {unpublish && <button disabled={pending} onClick={() => act("rejected")} className="inline-flex items-center gap-1.5 rounded-lg border border-bbb-border px-4 py-2 text-xs font-bold text-bbb-slate hover:border-red-300 hover:text-red-600 disabled:opacity-50">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Remove from site</button>}
        </div>
      </div>
    );
  }
}
