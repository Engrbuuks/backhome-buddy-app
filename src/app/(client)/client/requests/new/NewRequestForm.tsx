"use client";
import React from "react";
import { useFormState } from "react-dom";
import { Field, SelectField, TextAreaField } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { createRequest } from "@/lib/requests/actions";

interface Opt { id: string; name: string }
export default function NewRequestForm({ services, regions, recipients = [] }: { services: Opt[]; regions: Opt[]; recipients?: any[] }) {
  const [rec, setRec] = React.useState({ name: "", phone: "", address: "" });
  const [state, formAction] = useFormState(createRequest, { error: "" });
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-strong">New request</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold">Tell us what you need done</h1>
        <p className="mt-1 text-sm text-bbb-slate">Give us the details and we&apos;ll send you a quote.</p>
      </div>
      {state?.error && <div className="mb-4"><ErrorState title="Could not submit" message={state.error} /></div>}
      <form action={formAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <Field label="Short title" name="title" required placeholder="e.g. Verify property in Lekki" />
        <SelectField label="Service type" name="service_type_id">
          <option value="">Select a service (or leave blank for custom)</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>
        <SelectField label="Region" name="region_id">
          <option value="">Select a region</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </SelectField>
        <TextAreaField label="Describe what you need" name="description" placeholder="Give as much detail as possible..." />
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
