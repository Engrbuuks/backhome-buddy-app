"use client";
import React from "react";
import { useFormState } from "react-dom";
import { Field, SelectField, TextAreaField } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { createRequest } from "@/lib/requests/actions";
import { computeInstantPrice, isInstantlyPayable } from "@/lib/money/instant-price";

interface ServiceOpt { id: string; name: string; description?: string | null; pricing_mode?: string; from_price_usd?: number; requires_payee?: boolean; payee_label?: string | null }
interface RegionOpt { id: string; name: string; state?: string | null; zone?: string }

export default function NewRequestForm({ services, regions, recipients = [], zoneBUpliftPct = 25, urgentSurchargePct = 40 }: {
  services: ServiceOpt[]; regions: RegionOpt[]; recipients?: any[]; zoneBUpliftPct?: number; urgentSurchargePct?: number;
}) {
  const [rec, setRec] = React.useState({ name: "", phone: "", address: "" });
  const [serviceId, setServiceId] = React.useState("");
  const [regionId, setRegionId] = React.useState("");
  const [urgency, setUrgency] = React.useState("standard");
  const [payeeName, setPayeeName] = React.useState("");
  const [vendorAmount, setVendorAmount] = React.useState("");
  const [state, formAction] = useFormState(createRequest, { error: "" });

  const service = services.find((s) => s.id === serviceId);
  const region = regions.find((r) => r.id === regionId);
  const isOther = regionId === "__other__";

  const isUrgent = urgency === "urgent";
  const fixed = service ? isInstantlyPayable(service.pricing_mode, service.from_price_usd) : false;
  const needsPayee = Boolean(service?.requires_payee);

  // The SAME function the server uses to charge. The arithmetic used to live
  // only here, in the browser, which was safe while a human wrote every quote
  // and is not safe now that this figure is what gets charged.
  const quoted = service && !isOther
    ? computeInstantPrice({
        fromPriceUsd: Number(service.from_price_usd || 0),
        zone: (region?.zone as any) ?? null,
        zoneBUpliftPct,
        urgent: isUrgent,
        urgentSurchargePct,
      })
    : null;

  let priceHint: string | null = null;
  if (service) {
    if (isOther) {
      priceHint = "We'll review your location and send a free quote if we can reach it.";
    } else if (fixed && quoted && quoted.totalUsd > 0) {
      priceHint = region
        ? `$${Math.round(quoted.totalUsd)}${isUrgent ? " (urgent)" : ""} in ${region.name}. This is the price, not an estimate — pay and we start.`
        : `$${Math.round(quoted.totalUsd)}${isUrgent ? " (urgent)" : ""} in the major metros. Select your state for the exact price.`;
    } else if (service.pricing_mode === "from" && quoted && quoted.totalUsd > 0) {
      priceHint = region
        ? `From $${Math.round(quoted.totalUsd)}${isUrgent ? " (urgent)" : ""} in ${region.name}. Final quote confirmed before any payment.`
        : `From $${Math.round(quoted.totalUsd)}${isUrgent ? " (urgent)" : ""} (major metros). Select a state for your exact starting price.`;
    } else {
      priceHint = isUrgent
        ? "Priced per task with a priority surcharge for urgent handling — reflected in your free quote (we aim to quote urgent requests within 6 hours)."
        : "Priced per task — you'll get a free, detailed quote, usually within 24 hours.";
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-strong">New request</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold">Tell us what you need done</h1>
        <p className="mt-1 text-sm text-bbb-slate">Give us the details and we&apos;ll send you a quote. Quotes are free.</p>
      </div>
      {state?.error && <div className="mb-4"><ErrorState title="Could not submit" message={state.error} /></div>}
      <form action={formAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <Field label="Short title" name="title" required placeholder="e.g. Verify property in Lekki" />
        <SelectField label="Service type" name="service_type_id" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Select a service (or leave blank for custom)</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>
        <SelectField label="State / location" name="region_id" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
          <option value="">Select where the task happens</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          <option value="__other__">Another state (not listed yet)</option>
        </SelectField>
        {isOther && (
          <div className="space-y-3 rounded-2xl border border-bbb-border bg-bbb-bg p-4">
            <Field label="Which state?" name="requested_state" required placeholder="e.g. Kaduna" />
            <p className="text-xs leading-5 text-bbb-slate">We&apos;re expanding state by state. Tell us what you need — if we can reach it safely with a vetted buddy, we&apos;ll send you a quote.</p>
          </div>
        )}
        {priceHint && (
          <div className="rounded-2xl bg-bbb-soft p-3 text-sm font-semibold text-bbb-dark">{priceHint}</div>
        )}
        <TextAreaField label="Describe what you need" name="description" placeholder="Give as much detail as possible..." />

        {/* Purpose bound payment. Only appears for a service that settles a
            bill on the client's behalf, which is the whole point of it: the
            money goes to the institution, not to a person. */}
        {needsPayee && (
          <div className="rounded-2xl border-2 border-bbb-strong/30 bg-bbb-bg p-4">
            <p className="font-display text-sm font-extrabold">Who are we paying, and how much?</p>
            <p className="mt-1 text-xs leading-5 text-bbb-slate">
              We pay the institution directly and photograph the receipt. Your buddy never holds the cash, so the
              money cannot go anywhere other than where you sent it.
            </p>
            <div className="mt-3 space-y-3">
              <Field
                label={service?.payee_label || "Who should be paid"}
                name="payee_name"
                required
                value={payeeName}
                onChange={(e: any) => setPayeeName(e.target.value)}
                placeholder="e.g. Hillcrest Secondary School, Bursary Department"
              />
              <Field
                label="Amount to be paid, in naira"
                name="vendor_amount_ngn"
                type="number"
                required
                value={vendorAmount}
                onChange={(e: any) => setVendorAmount(e.target.value)}
                placeholder="e.g. 185000"
              />
              <TextAreaField
                label="What is it for, and any reference number"
                name="payee_detail"
                rows={3}
                placeholder={"e.g. Second term fees for Chidera Okeke, admission number 2024/0431\ne.g. Pay at the bursary and get a stamped receipt"}
              />
            </div>
            {vendorAmount && Number(vendorAmount) > 0 && quoted && quoted.totalUsd > 0 && (
              <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-bbb-charcoal">
                You will pay <strong>₦{Number(vendorAmount).toLocaleString()}</strong> for the bill itself, plus our
                service fee of about <strong>${Math.round(quoted.totalUsd)}</strong>. The bill amount passes straight
                through to {payeeName || "them"} and we keep none of it.
              </p>
            )}
          </div>
        )}
        <div>
          <TextAreaField label="Your checklist (optional)" name="expectations" rows={4} placeholder={"One item per line — what does success look like?\ne.g. Photo of the building from the street\ne.g. Confirm the caretaker's name and phone\ne.g. Video walking through every room"} />
          <p className="mt-1 text-xs text-bbb-slate">We&apos;ll share this with your buddy and check the proof against it. Your confirmed quote remains the agreed scope.</p>
        </div>
        <div>
          <SelectField label="Urgency" name="urgency" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="standard">Standard</option>
            <option value="urgent">Urgent — needs to start within 24–48 hours</option>
          </SelectField>
          <p className="mt-1 text-xs text-bbb-slate">Urgent tasks jump the queue, are quoted first, usually within 6 hours, and carry a priority surcharge.</p>
        </div>
        {recipients.length > 0 && (
          <SelectField label="Use a saved recipient" onChange={(e) => { const r = recipients.find((x) => x.id === e.target.value); if (r) setRec({ name: r.name ?? "", phone: r.phone ?? "", address: r.address ?? "" }); }}>
            <option value="">Choose saved recipient (optional)</option>
            {recipients.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </SelectField>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Recipient name" name="recipient_name" value={rec.name} onChange={(e) => setRec({ ...rec, name: e.target.value })} placeholder="Who we'll be dealing with" />
          <Field label="Recipient phone" name="recipient_phone" value={rec.phone} onChange={(e) => setRec({ ...rec, phone: e.target.value })} placeholder="Phone number" />
        </div>
        <Field label="Recipient address" name="recipient_address" value={rec.address} onChange={(e) => setRec({ ...rec, address: e.target.value })} placeholder="Address / location" />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Submit request</button>
      </form>
    </div>
  );
}
