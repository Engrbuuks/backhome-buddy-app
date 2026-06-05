"use client";
import React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Field, SelectField, TextAreaField } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { signUpBuddy } from "@/lib/auth/actions";

const NG_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta",
  "Ebonyi","Edo","Ekiti","Enugu","FCT (Abuja)","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina",
  "Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers",
  "Sokoto","Taraba","Yobe","Zamfara",
];

function SubmitBtn() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="h-12 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">{pending ? "Submitting…" : "Submit application"}</button>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="border-b border-bbb-border pb-2 pt-2 text-xs font-extrabold uppercase tracking-wide text-bbb-slate">{children}</p>;
}

function Check({ name, label, required = false }: { name: string; label: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex items-start gap-3 text-sm leading-6 text-bbb-charcoal">
      <input type="checkbox" name={name} required={required} className="mt-1 h-4 w-4 rounded border-bbb-border accent-[#079516]" />
      <span>{label}</span>
    </label>
  );
}

export default function ApplyForm() {
  const [state, formAction] = useFormState(signUpBuddy, { error: "" });
  const [hasRecord, setHasRecord] = React.useState("");

  if ((state as any)?.done) {
    return (
      <AuthLayout eyebrow="Application received" title="Thank you for applying!" subtitle="What happens next:" sideTitle="Earn by helping the diaspora get things done.">
        <div className="space-y-3 rounded-2xl border border-bbb-border bg-white p-5 text-sm leading-7 text-bbb-slate">
          <p><span className="font-bold text-bbb-charcoal">1.</span> Confirm your email — we&apos;ve sent you a verification link.</p>
          <p><span className="font-bold text-bbb-charcoal">2.</span> Our team reviews every application. If shortlisted, you&apos;ll be asked to complete verification in your portal — ID document, proof of address, two guarantors and a Police Character Certificate.</p>
          <p><span className="font-bold text-bbb-charcoal">3.</span> After a short interview and training, you&apos;re activated and tasks appear in your portal.</p>
          <a href="/login" className="inline-block font-bold text-bbb-strong">Go to login →</a>
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout eyebrow="Become a buddy" title="Apply to join the network" subtitle="Trust is our product — every buddy is vetted. The application takes about 5 minutes." sideTitle="Earn by helping the diaspora get things done.">
      {state?.error && <div className="mb-5"><ErrorState title="Could not submit" message={state.error} /></div>}
      <form action={formAction} className="space-y-4">
        <SectionTitle>Your details</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full legal name" name="full_name" required placeholder="As it appears on your ID" />
          <Field label="Date of birth" name="date_of_birth" type="date" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone (WhatsApp)" name="phone" required placeholder="+234..." />
          <Field label="Email" name="email" type="email" required />
        </div>
        <Field label="NIN (National Identification Number)" name="nin" required inputMode="numeric" minLength={11} maxLength={11} pattern="\d{11}" placeholder="11 digits" />

        <SectionTitle>Where you live &amp; operate</SectionTitle>
        <Field label="Residential address" name="address" required placeholder="House number, street, area" />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="State" name="state" required defaultValue="">
            <option value="" disabled>Select state</option>
            {NG_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectField>
          <Field label="LGA" name="lga" required placeholder="Local Govt Area" />
          <Field label="City/Town" name="city" required placeholder="e.g. Ikeja" />
        </div>
        <Field label="Areas you can cover" name="coverage_areas" placeholder="e.g. Ikeja, Yaba, Surulere — or 'anywhere in Lagos'" />

        <SectionTitle>Work &amp; capability</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current occupation" name="occupation" required placeholder="e.g. Dispatch rider, Estate agent" />
          <SelectField label="Availability" name="availability" required defaultValue="">
            <option value="" disabled>Select availability</option>
            <option value="full_time">Full-time (weekdays + weekends)</option>
            <option value="weekdays">Weekdays only</option>
            <option value="weekends">Weekends only</option>
            <option value="flexible">Flexible / on request</option>
          </SelectField>
        </div>
        <TextAreaField label="Relevant experience" name="experience" rows={3} placeholder="Anything that shows you can handle tasks reliably — logistics, real estate, admin, field work…" />
        <Field label="Skills (comma-separated)" name="skills" placeholder="property verification, deliveries, document processing" />
        <div className="space-y-2 rounded-2xl border border-bbb-border bg-bbb-bg p-4">
          <Check name="has_smartphone" required label={<><span className="font-semibold">I own a smartphone with a working camera</span> — required: every task ends with photo/video proof.</>} />
          <Check name="can_drive" label="I can ride a motorcycle or drive a car" />
          <Check name="has_drivers_license" label="I hold a valid rider's card / driver's license" />
        </div>

        <SectionTitle>Declarations</SectionTitle>
        <div className="space-y-3 rounded-2xl border border-bbb-border bg-bbb-bg p-4">
          <p className="text-sm font-semibold text-bbb-charcoal">Have you ever been convicted of a criminal offence?</p>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="criminal_record" value="no" required onChange={() => setHasRecord("no")} className="accent-[#079516]" /> No</label>
            <label className="flex items-center gap-2"><input type="radio" name="criminal_record" value="yes" onChange={() => setHasRecord("yes")} className="accent-[#079516]" /> Yes</label>
          </div>
          {hasRecord === "yes" && (
            <TextAreaField label="Brief details" name="criminal_record_details" rows={2} placeholder="A declaration is not automatic disqualification — honesty is." />
          )}
        </div>
        <div className="space-y-2 rounded-2xl border border-bbb-border bg-bbb-bg p-4">
          <Check name="consent_background_checks" required label="I consent to background, identity, reference and guarantor checks, including a Police Character Certificate if shortlisted." />
          <Check name="consent_data_processing" required label="I consent to Backhome Buddy processing the information I provide for vetting and operations, in line with its privacy policy." />
          <Check name="declare_true" required label={<><span className="font-semibold">I declare that all information provided is true.</span> False information leads to permanent disqualification.</>} />
        </div>

        <SectionTitle>Account</SectionTitle>
        <Field label="Password" name="password" type="password" required placeholder="At least 8 characters" />
        <SubmitBtn />
        <p className="text-center text-xs text-bbb-slate">Already a buddy? <a href="/login" className="font-bold text-bbb-strong">Log in</a></p>
      </form>
    </AuthLayout>
  );
}
