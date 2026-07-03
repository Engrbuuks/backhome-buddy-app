"use client";
import React, { useRef, useState, useEffect } from "react";
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

const GRAD_YEARS = Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => new Date().getFullYear() - i);

const STEPS = ["Your details", "Where you operate", "Declarations"];

function SubmitBtn() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="h-12 flex-1 rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">{pending ? "Submitting…" : "Submit application"}</button>;
}

function Check({ name, label, checked, onChange }: { name: string; label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 text-sm leading-6 text-bbb-charcoal">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 rounded border-bbb-border accent-[#079516]" />
      <span>{label}</span>
    </label>
  );
}

export default function ApplyForm() {
  const [state, formAction] = useFormState(signUpBuddy, { error: "" });
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // controlled values for everything we validate per step
  const [v, setV] = useState({
    full_name: "", email: "", phone: "", password: "",
    date_of_birth: "", nin: "",
    address: "", state: "", lga: "", city: "", coverage_areas: "",
    occupation: "", availability: "", experience: "", skills: "",
    education_level: "", course_of_study: "", year_of_graduation: "", school_attended: "",
    criminal_record: "", criminal_record_details: "",
  });
  const [checks, setChecks] = useState({ has_smartphone: false, can_drive: false, has_drivers_license: false, consent_background_checks: false, consent_data_processing: false, declare_true: false });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  // server errors: always scroll into view
  useEffect(() => {
    if (state?.error || stepError) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state?.error, stepError]);

  function validateStep(i: number): string {
    if (i === 0) {
      if (!v.full_name.trim()) return "Enter your full legal name.";
      if (!/^\S+@\S+\.\S+$/.test(v.email)) return "Enter a valid email address.";
      if (v.phone.replace(/\D/g, "").length < 10) return "Enter a valid phone number (WhatsApp preferred).";
      if (v.password.length < 8) return "Password must be at least 8 characters.";
      if (!v.date_of_birth) return "Enter your date of birth.";
      const age = (Date.now() - new Date(v.date_of_birth).getTime()) / 31557600000;
      if (!(age >= 18)) return "You must be at least 18 years old to apply.";
      if (v.nin.replace(/\D/g, "").length !== 11) return "Your NIN is 11 digits — check and re-enter.";
    }
    if (i === 1) {
      if (!v.address.trim()) return "Enter your residential address.";
      if (!v.state) return "Select your state.";
      if (!v.lga.trim()) return "Enter your Local Government Area.";
      if (!v.city.trim()) return "Enter your city or town.";
      if (!v.occupation.trim()) return "Tell us your current occupation.";
      if (!v.availability) return "Select your availability.";
      if (!checks.has_smartphone) return "A smartphone with a working camera is required — every task ends with photo and video proof.";
    }
    if (i === 2) {
      if (!["yes", "no"].includes(v.criminal_record)) return "Answer the criminal record declaration.";
      if (v.criminal_record === "yes" && !v.criminal_record_details.trim()) return "Please give brief details of your declaration.";
      if (!checks.consent_background_checks) return "Consent to background and reference checks is required to apply.";
      if (!checks.consent_data_processing) return "Consent to data processing for vetting is required to apply.";
      if (!checks.declare_true) return "Confirm that the information you provided is true.";
    }
    return "";
  }

  function next() {
    const err = validateStep(step);
    setStepError(err);
    if (!err) { setStep((s) => s + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  if ((state as any)?.done) {
    return (
      <AuthLayout eyebrow="Application received" title="Thank you for applying!" subtitle="What happens next:" sideTitle="Earn by helping the diaspora get things done.">
        <div className="space-y-3 rounded-2xl border border-bbb-border bg-white p-5 text-sm leading-7 text-bbb-slate">
          <p><span className="font-bold text-bbb-charcoal">1.</span> Confirm your email — we&apos;ve sent you a verification link.</p>
          <p><span className="font-bold text-bbb-charcoal">2.</span> Our team reviews every application. If shortlisted, you&apos;ll complete verification in your portal — ID document, proof of address, two guarantors and a Police Character Certificate.</p>
          <p><span className="font-bold text-bbb-charcoal">3.</span> After a short interview and training, you&apos;re activated and tasks appear in your portal.</p>
          <a href="/login" className="inline-block font-bold text-bbb-strong">Go to login →</a>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Become a buddy" title="Apply to join the network" subtitle="Trust is our product — every buddy is vetted. Three short steps, about 4 minutes." sideTitle="Earn by helping the diaspora get things done.">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className={`h-1.5 w-full rounded-full ${i <= step ? "bg-bbb-strong" : "bg-bbb-border"}`} />
            <span className={`text-[11px] font-bold ${i === step ? "text-bbb-strong" : "text-bbb-slate"}`}>{i + 1}. {label}</span>
          </div>
        ))}
      </div>

      <div ref={errorRef}>
        {stepError && <div className="mb-4"><ErrorState title="One more thing" message={stepError} /></div>}
        {state?.error && <div className="mb-4"><ErrorState title="Could not submit" message={state.error} /></div>}
      </div>

      <form
        ref={formRef}
        action={formAction}
        noValidate
        onSubmit={(e) => {
          const err = validateStep(2);
          if (err) { e.preventDefault(); setStepError(err); }
          else setStepError("");
        }}
        className="space-y-4"
      >
        {/* ---- STEP 1: Your details ---- */}
        <div className={step === 0 ? "space-y-4" : "hidden"}>
          <Field label="Full legal name" name="full_name" value={v.full_name} onChange={set("full_name")} placeholder="As it appears on your ID" autoComplete="name" />
          <Field label="Email address" name="email" type="email" value={v.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone (WhatsApp)" name="phone" value={v.phone} onChange={set("phone")} placeholder="+234..." autoComplete="tel" />
            <Field label="Create a password" name="password" type="password" value={v.password} onChange={set("password")} placeholder="At least 8 characters" autoComplete="new-password" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date of birth" name="date_of_birth" type="date" value={v.date_of_birth} onChange={set("date_of_birth")} />
            <Field label="NIN (11 digits)" name="nin" inputMode="numeric" value={v.nin} onChange={set("nin")} placeholder="National Identification Number" />
          </div>
        </div>

        {/* ---- STEP 2: Where you operate ---- */}
        <div className={step === 1 ? "space-y-4" : "hidden"}>
          <Field label="Residential address" name="address" value={v.address} onChange={set("address")} placeholder="House number, street, area" />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="State" name="state" value={v.state} onChange={set("state")}>
              <option value="">Select state</option>
              {NG_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectField>
            <Field label="LGA" name="lga" value={v.lga} onChange={set("lga")} placeholder="Local Govt Area" />
            <Field label="City/Town" name="city" value={v.city} onChange={set("city")} placeholder="e.g. Ikeja" />
          </div>
          <Field label="Areas you can cover" name="coverage_areas" value={v.coverage_areas} onChange={set("coverage_areas")} placeholder="e.g. Ikeja, Yaba, Surulere — or 'anywhere in Lagos'" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Current occupation" name="occupation" value={v.occupation} onChange={set("occupation")} placeholder="e.g. Dispatch rider, Estate agent" />
            <SelectField label="Availability" name="availability" value={v.availability} onChange={set("availability")}>
              <option value="">Select availability</option>
              <option value="full_time">Full-time (weekdays + weekends)</option>
              <option value="weekdays">Weekdays only</option>
              <option value="weekends">Weekends only</option>
              <option value="flexible">Flexible / on request</option>
            </SelectField>
          </div>
          <TextAreaField label="Relevant experience (optional)" name="experience" rows={3} value={v.experience} onChange={set("experience")} placeholder="Anything that shows you can handle tasks reliably — logistics, real estate, admin, field work…" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Highest level of education" name="education_level" value={v.education_level} onChange={set("education_level")}>
              <option value="">Select level</option>
              <option value="PhD">PhD</option>
              <option value="MSc">MSc</option>
              <option value="BSc">BSc</option>
              <option value="HND">HND</option>
              <option value="OND">OND</option>
              <option value="SSCE">SSCE</option>
            </SelectField>
            <SelectField label="Year of graduation" name="year_of_graduation" value={v.year_of_graduation} onChange={set("year_of_graduation")}>
              <option value="">Select year</option>
              {GRAD_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </SelectField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course of study" name="course_of_study" value={v.course_of_study} onChange={set("course_of_study")} placeholder="e.g. Estate Management" />
            <Field label="School attended" name="school_attended" value={v.school_attended} onChange={set("school_attended")} placeholder="e.g. University of Lagos" />
          </div>
          <Field label="Skills (comma-separated, optional)" name="skills" value={v.skills} onChange={set("skills")} placeholder="property verification, deliveries, document processing" />
          <div className="space-y-2 rounded-2xl border border-bbb-border bg-bbb-bg p-4">
            <Check name="has_smartphone" checked={checks.has_smartphone} onChange={(x) => setChecks((c) => ({ ...c, has_smartphone: x }))} label={<><span className="font-semibold">I own a smartphone with a working camera</span> — required: every task ends with photo/video proof.</>} />
            <Check name="can_drive" checked={checks.can_drive} onChange={(x) => setChecks((c) => ({ ...c, can_drive: x }))} label="I can ride a motorcycle or drive a car" />
            <Check name="has_drivers_license" checked={checks.has_drivers_license} onChange={(x) => setChecks((c) => ({ ...c, has_drivers_license: x }))} label="I hold a valid rider's card / driver's license" />
          </div>
        </div>

        {/* ---- STEP 3: Declarations ---- */}
        <div className={step === 2 ? "space-y-4" : "hidden"}>
          <div className="space-y-3 rounded-2xl border border-bbb-border bg-bbb-bg p-4">
            <p className="text-sm font-semibold text-bbb-charcoal">Have you ever been convicted of a criminal offence?</p>
            <div className="flex gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="criminal_record" value="no" checked={v.criminal_record === "no"} onChange={set("criminal_record")} className="accent-[#079516]" /> No</label>
              <label className="flex items-center gap-2"><input type="radio" name="criminal_record" value="yes" checked={v.criminal_record === "yes"} onChange={set("criminal_record")} className="accent-[#079516]" /> Yes</label>
            </div>
            {v.criminal_record === "yes" && (
              <TextAreaField label="Brief details" name="criminal_record_details" rows={2} value={v.criminal_record_details} onChange={set("criminal_record_details")} placeholder="A declaration is not automatic disqualification — honesty is." />
            )}
          </div>
          <div className="space-y-2 rounded-2xl border border-bbb-border bg-bbb-bg p-4">
            <Check name="consent_background_checks" checked={checks.consent_background_checks} onChange={(x) => setChecks((c) => ({ ...c, consent_background_checks: x }))} label="I consent to background, identity, reference and guarantor checks, including a Police Character Certificate if shortlisted." />
            <Check name="consent_data_processing" checked={checks.consent_data_processing} onChange={(x) => setChecks((c) => ({ ...c, consent_data_processing: x }))} label="I consent to Backhome Buddy processing the information I provide for vetting and operations, in line with its privacy policy." />
            <Check name="declare_true" checked={checks.declare_true} onChange={(x) => setChecks((c) => ({ ...c, declare_true: x }))} label={<><span className="font-semibold">I declare that all information provided is true.</span> False information leads to permanent disqualification.</>} />
          </div>
        </div>

        {/* ---- Navigation ---- */}
        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <button type="button" onClick={() => { setStepError(""); setStep((s) => s - 1); }} className="h-12 rounded-xl border border-bbb-border bg-white px-6 text-sm font-bold">Back</button>
          )}
          {step < 2 ? (
            <button type="button" onClick={next} className="h-12 flex-1 rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Continue →</button>
          ) : (
            <SubmitBtn />
          )}
        </div>
        <p className="text-center text-xs text-bbb-slate">Already a buddy? <a href="/login" className="font-bold text-bbb-strong">Log in</a></p>
      </form>
    </AuthLayout>
  );
}
