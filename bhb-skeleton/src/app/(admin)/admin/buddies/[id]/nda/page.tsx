import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { redirect, notFound } from "next/navigation";
import { NDA_TITLE, NDA_CLAUSES, NDA_VERSION } from "@/lib/legal/nda";
import NdaPrintButton from "./NdaPrintButton";

export const dynamic = "force-dynamic";

/** Admin-only view of a buddy's signed NDA — the full agreement text stamped
 *  with their signature (typed name, date, version). Printable / downloadable
 *  as PDF via the browser (optional). */
export default async function SignedNdaPage({ params }: { params: { id: string } }) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");

  const db = createAdminClient();
  const { data: b } = await db
    .from("buddy_profiles")
    .select("id, nda_signed_at, nda_signed_name, nda_version, profiles!buddy_profiles_id_fkey(full_name, email)")
    .eq("id", params.id)
    .maybeSingle();

  if (!b) notFound();

  const prof: any = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
  const signed = Boolean(b.nda_signed_at);
  const signedDate = b.nda_signed_at
    ? new Date(b.nda_signed_at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Screen-only toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a href="/admin/buddies" className="text-sm font-bold text-bbb-strong hover:underline">← Back to Buddy Management</a>
        {signed && <NdaPrintButton />}
      </div>

      {!signed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-bold text-amber-800">This buddy has not signed the NDA yet.</p>
          <p className="mt-1 text-sm text-amber-700">There is no signed agreement to view until they sign it in their portal.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-bbb-border bg-white p-8 shadow-soft print:border-0 print:shadow-none print:p-0">
          {/* Header */}
          <div className="mb-6 border-b border-bbb-border pb-5 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-bbb-strong">Backhome Buddy</p>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-bbb-charcoal">{NDA_TITLE}</h1>
            <p className="mt-1 text-xs text-bbb-slate">Version {b.nda_version || NDA_VERSION}</p>
          </div>

          {/* Signature block — prominent at top */}
          <div className="mb-7 rounded-xl bg-bbb-soft p-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-bbb-strong">Electronically signed by</p>
            <p className="font-display text-xl font-extrabold text-bbb-charcoal">{b.nda_signed_name}</p>
            <div className="mt-2 grid gap-1 text-sm text-bbb-charcoal sm:grid-cols-2">
              <p><span className="text-bbb-slate">Account name:</span> {prof?.full_name || "—"}</p>
              <p><span className="text-bbb-slate">Account email:</span> {prof?.email || "—"}</p>
              <p><span className="text-bbb-slate">Signed on:</span> {signedDate}</p>
              <p><span className="text-bbb-slate">Version signed:</span> {b.nda_version || NDA_VERSION}</p>
            </div>
          </div>

          {/* Full agreement text */}
          <div className="space-y-4">
            {NDA_CLAUSES.map((c) => (
              <div key={c.heading}>
                <h2 className="font-bold text-bbb-charcoal">{c.heading}</h2>
                <p className="mt-1 text-sm leading-relaxed text-bbb-charcoal">{c.body}</p>
              </div>
            ))}
          </div>

          {/* Footer attestation */}
          <div className="mt-8 border-t border-bbb-border pt-5 text-xs text-bbb-slate">
            <p>
              This document is a record of an electronic signature. On {signedDate}, {b.nda_signed_name} typed their full
              legal name to confirm they had read, understood, and agreed to be bound by version {b.nda_version || NDA_VERSION} of
              this Agreement. This electronic signature is valid and binding.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
