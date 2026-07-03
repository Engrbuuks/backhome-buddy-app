"use client";
import React, { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Field, SelectField } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { createClient } from "@/lib/supabase/client";
import { recordVettingDoc, saveGuarantors, saveNextOfKin, signNda } from "@/lib/buddy/vetting-actions";
import { NDA_TITLE, NDA_CLAUSES, NDA_VERSION } from "@/lib/legal/nda";
import { CheckCircle2, Circle, Upload, ShieldCheck } from "lucide-react";

function NdaSection({ v }: { v: any }) {
  const signed = Boolean(v.nda_signed_at);
  const suggestedName = v.nda_signed_name || v.profiles?.full_name || "";
  const [name, setName] = useState(suggestedName);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [openText, setOpenText] = useState(false);
  const [doneNow, setDoneNow] = useState(false);

  const sign = async () => {
    setBusy(true); setErr("");
    const res = await signNda(name);
    setBusy(false);
    if (res.error) setErr(res.error); else setDoneNow(true);
  };

  if (signed || doneNow) {
    return (
      <div className="mt-5 rounded-3xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-center gap-2 text-green-800">
          <ShieldCheck className="h-5 w-5" />
          <p className="font-display text-base font-extrabold">Confidentiality Agreement signed</p>
        </div>
        <p className="mt-2 text-sm text-green-800">
          Signed by <strong>{v.nda_signed_name || name}</strong>
          {v.nda_signed_at ? ` on ${new Date(v.nda_signed_at).toLocaleDateString()}` : ""} (v{v.nda_version || NDA_VERSION}). Thank you.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-3xl border-2 border-bbb-strong bg-white p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-bbb-strong" />
        <p className="font-display text-base font-extrabold">Step 1 — Sign your Confidentiality Agreement</p>
      </div>
      <p className="mt-2 text-sm text-bbb-slate">
        Trust is our product. Before you can be approved, every buddy signs this Non-Disclosure &amp; Confidentiality Agreement.
        Please read it and sign below.
      </p>

      <button type="button" onClick={() => setOpenText(!openText)} className="mt-3 text-sm font-bold text-bbb-strong">
        {openText ? "Hide agreement" : "Read the full agreement"}
      </button>

      {openText && (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-bbb-border bg-bbb-bg p-4 text-sm leading-6 text-bbb-charcoal">
          <p className="mb-3 font-extrabold">{NDA_TITLE} (v{NDA_VERSION})</p>
          {NDA_CLAUSES.map((c) => (
            <div key={c.heading} className="mb-3">
              <p className="font-bold">{c.heading}</p>
              <p className="text-bbb-slate">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#079516]" />
          <span>I have read and agree to be bound by the Backhome Buddy Confidentiality Agreement, and I agree my electronic signature is valid and binding.</span>
        </label>
        <div>
          <label className="mb-1 block text-xs font-bold text-bbb-slate">Type your full legal name to sign</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chinedu Okafor" className="h-11 w-full rounded-xl border border-bbb-border bg-white px-4 text-sm outline-none focus:border-bbb-strong" />
        </div>
        {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
        <button
          disabled={busy || !agree || name.trim().length < 3}
          onClick={sign}
          className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
        >{busy ? "Signing…" : "Sign the agreement"}</button>
      </div>
    </div>
  );
}

function SaveBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">{pending ? "Saving…" : label}</button>;
}

function Item({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? <CheckCircle2 className="h-4 w-4 text-bbb-strong" /> : <Circle className="h-4 w-4 text-bbb-border" />}
      <span className={done ? "text-bbb-charcoal" : "text-bbb-slate"}>{label}</span>
    </li>
  );
}

/** Compress images in the browser before upload (same approach as task proofs). */
async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    return blob && blob.size < file.size ? blob : file;
  } catch { return file; }
}

function DocUpload({ buddyId, kind, title, hint, currentPath, needsType, currentType }: {
  buddyId: string; kind: string; title: string; hint: string;
  currentPath?: string | null; needsType?: boolean; currentType?: string | null;
}) {
  const [state, formAction] = useFormState(recordVettingDoc, { error: "" });
  const [path, setPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [upError, setUpError] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUpError(""); setPath("");
    const supabase = createClient();
    const isPdf = file.type === "application/pdf";
    const payload = isPdf ? file : await compressImage(file);
    const ext = isPdf ? "pdf" : "jpg";
    const p = `${buddyId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("vetting").upload(p, payload, {
      contentType: isPdf ? "application/pdf" : "image/jpeg",
      upsert: true,
    });
    if (error) { setUpError(error.message); setUploading(false); return; }
    setPath(p); setUploading(false);
  }

  const uploaded = Boolean(currentPath) && !path;
  return (
    <form action={formAction} className="space-y-3 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-base font-extrabold">{title}</p>
        {uploaded && <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">Uploaded ✓</span>}
      </div>
      <p className="text-xs leading-5 text-bbb-slate">{hint}</p>
      {state?.error && <ErrorState title="Could not save" message={state.error} />}
      {upError && <ErrorState title="Upload failed" message={upError} />}
      {(state as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Saved — our team will verify it.</div>}
      {needsType && (
        <SelectField label="Which document?" name="id_doc_type" required defaultValue={currentType ?? ""}>
          <option value="" disabled>Select document type</option>
          <option value="nin_slip">NIN slip</option>
          <option value="voters_card">Voter&apos;s card</option>
          <option value="drivers_license">Driver&apos;s license</option>
          <option value="intl_passport">International passport</option>
        </SelectField>
      )}
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-bbb-border bg-bbb-bg p-4 text-sm font-semibold text-bbb-slate hover:border-bbb-strong">
        <Upload className="h-4 w-4" />
        {uploading ? "Uploading…" : path ? "Ready — press Save" : uploaded ? "Replace file" : "Choose photo or PDF"}
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={onPick} disabled={uploading} />
      </label>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="path" value={path} />
      {path && <SaveBtn label="Save document" />}
    </form>
  );
}

export default function VettingCenter({ v }: { v: any }) {
  const [gState, gAction] = useFormState(saveGuarantors, { error: "" });
  const [nState, nAction] = useFormState(saveNextOfKin, { error: "" });
  const gs = Array.isArray(v.guarantors) ? v.guarantors : [];
  const nok = v.next_of_kin ?? {};
  const hasGuarantors = gs.length >= 2;
  const hasNok = Boolean(nok?.name);
  const hasBank = Boolean(v.bank_account_number);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-extrabold">Verification</h1>
      <p className="mt-1 text-sm text-bbb-slate">
        Trust is what clients pay us for — completing these checks is what activates your account.
        Documents go to private, encrypted storage and are seen only by our vetting team.
      </p>

      <NdaSection v={v} />

      <div className="mt-5 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        <p className="mb-3 font-display text-base font-extrabold">Your progress</p>
        <ul className="space-y-2">
          <Item done={Boolean(v.nda_signed_at)} label="Confidentiality Agreement signed" />
          <Item done={Boolean(v.id_doc_path)} label="Government ID uploaded" />
          <Item done={Boolean(v.utility_bill_path)} label="Proof of address uploaded (utility bill)" />
          <Item done={hasGuarantors} label="Two guarantors provided" />
          <Item done={Boolean(v.pcc_path)} label="Police Character Certificate uploaded" />
          <Item done={hasNok} label="Next of kin provided" />
          <Item done={hasBank} label="Payout bank details (under Payout Details tab)" />
        </ul>
        <p className="mt-3 text-xs text-bbb-slate">After everything is in, we verify, interview and train you — then you&apos;re activated.</p>
      </div>

      <div className="mt-5 space-y-5">
        <DocUpload buddyId={v.id} kind="id_doc" title="Government ID" needsType currentType={v.id_doc_type}
          hint="A clear photo of your NIN slip, voter's card, driver's license or international passport. All corners visible, no glare."
          currentPath={v.id_doc_path} />
        <DocUpload buddyId={v.id} kind="utility_bill" title="Proof of address"
          hint="A utility bill (NEPA/PHCN, water, waste) or bank statement from the last 3 months showing your name or your stated address."
          currentPath={v.utility_bill_path} />
        <DocUpload buddyId={v.id} kind="pcc" title="Police Character Certificate"
          hint="Obtainable from the Nigeria Police (possintl.npf.gov.ng or your state CID). Upload the certificate or the application receipt while you wait for issuance."
          currentPath={v.pcc_path} />

        <form action={gAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-base font-extrabold">Two guarantors</p>
            {hasGuarantors && <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">Provided ✓</span>}
          </div>
          <p className="text-xs leading-5 text-bbb-slate">
            People of standing who vouch for you — at least one should be a civil servant, clergy, lawyer, banker or established business owner.
            We will contact them. They must not be family members living at your address.
          </p>
          {gState?.error && <ErrorState title="Could not save" message={gState.error} />}
          {(gState as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Guarantors saved.</div>}
          {[1, 2].map((i) => (
            <fieldset key={i} className="space-y-3 rounded-2xl border border-bbb-border bg-bbb-bg p-4">
              <legend className="px-1 text-sm font-bold">Guarantor {i}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" name={`g${i}_name`} required defaultValue={gs[i - 1]?.name ?? ""} />
                <Field label="Occupation" name={`g${i}_occupation`} required defaultValue={gs[i - 1]?.occupation ?? ""} placeholder="e.g. Civil servant" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Phone" name={`g${i}_phone`} required defaultValue={gs[i - 1]?.phone ?? ""} placeholder="+234..." />
                <Field label="Relationship to you" name={`g${i}_relationship`} required defaultValue={gs[i - 1]?.relationship ?? ""} placeholder="e.g. Former employer" />
              </div>
              <Field label="Address" name={`g${i}_address`} required defaultValue={gs[i - 1]?.address ?? ""} />
            </fieldset>
          ))}
          <SaveBtn label="Save guarantors" />
        </form>

        <form action={nAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-base font-extrabold">Next of kin</p>
            {hasNok && <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">Provided ✓</span>}
          </div>
          <p className="text-xs leading-5 text-bbb-slate">For your own safety on field tasks — who we contact in an emergency.</p>
          {nState?.error && <ErrorState title="Could not save" message={nState.error} />}
          {(nState as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Next of kin saved.</div>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Full name" name="nok_name" required defaultValue={nok?.name ?? ""} />
            <Field label="Relationship" name="nok_relationship" required defaultValue={nok?.relationship ?? ""} placeholder="e.g. Sister" />
            <Field label="Phone" name="nok_phone" required defaultValue={nok?.phone ?? ""} placeholder="+234..." />
          </div>
          <SaveBtn label="Save next of kin" />
        </form>
      </div>
    </div>
  );
}
