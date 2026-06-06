"use client";
import React from "react";
import { useFormState } from "react-dom";
import { Field, SelectField, TextAreaField } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { createRequest } from "@/lib/requests/actions";

interface ServiceOpt { id: string; name: string; pricing_mode?: string; from_price_usd?: number }
interface RegionOpt { id: string; name: string; state?: string | null; zone?: string }

export default function NewRequestForm({ services, regions, recipients = [], zoneBUpliftPct = 25 }: {
  services: ServiceOpt[]; regions: RegionOpt[]; recipients?: any[]; zoneBUpliftPct?: number;
}) {
  const [rec, setRec] = React.useState({ name: "", phone: "", address: "" });
  const [serviceId, setServiceId] = React.useState("");
  const [regionId, setRegionId] = React.useState("");
  const [state, formAction] = useFormState(createRequest, { error: "" });

  const service = services.find((s) => s.id === serviceId);
  const region = regions.find((r) => r.id === regionId);
  const isOther = regionId === "__other__";

  let priceHint: string | null = null;
  if (service) {
    if (service.pricing_mode === "from" && Number(service.from_price_usd) > 0) {
      const base = Number(service.from_price_usd);
      if (isOther) {
        priceHint = "We'll review your location and send a free quote if we can reach it.";
      } else if (region) {
        const amount = region.zone === "A" ? base : Math.round(base * (1 + zoneBUpliftPct / 100));
        priceHint = `From $${amount} in ${region.name}. Final quote confirmed before any payment.`;
      } else {
        priceHint = `From $${base} (major metros). Select a state for your exact starting price.`;
      }
    } else {
      priceHint = "Priced per task — you'll get a free, detailed quote within 24 hours.";
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
        <div>
          <TextAreaField label="Your checklist (optional)" name="expectations" rows={4} placeholder={"One item per line — what does success look like?\ne.g. Photo of the building from the street\ne.g. Confirm the caretaker's name and phone\ne.g. Video walking through every room"} />
          <p className="mt-1 text-xs text-bbb-slate">We&apos;ll share this with your buddy and check the proof against it. Your confirmed quote remains the agreed scope.</p>
        </div>
        <SelectField label="Urgency" name="urgency">
          <option value="standard">Standard</option>
          <option value="urgent">Urgent</option>
        </SelectField>
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
