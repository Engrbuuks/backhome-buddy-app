"use client";
import React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { signUpBuddy } from "@/lib/auth/actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="h-12 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">{pending ? "Submitting…" : "Submit application"}</button>;
}

export default function ApplyForm() {
  const [state, formAction] = useFormState(signUpBuddy, { error: "" });
  if ((state as any)?.done) {
    return (
      <AuthLayout eyebrow="Application received" title="Thank you for applying!" subtitle="Two quick steps remain:" sideTitle="Earn by helping the diaspora get things done.">
        <div className="space-y-3 rounded-2xl border border-bbb-border bg-white p-5 text-sm leading-7 text-bbb-slate">
          <p><span className="font-bold text-bbb-charcoal">1.</span> Confirm your email — we&apos;ve sent you a verification link.</p>
          <p><span className="font-bold text-bbb-charcoal">2.</span> Our team reviews and vets every application. We&apos;ll be in touch — once approved, tasks appear in your portal.</p>
          <a href="/login" className="inline-block font-bold text-bbb-strong">Go to login →</a>
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout eyebrow="Become a buddy" title="Apply to join the network" subtitle="Earn by completing verified tasks in your city." sideTitle="Earn by helping the diaspora get things done.">
      {state?.error && <div className="mb-5"><ErrorState title="Could not submit" message={state.error} /></div>}
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="full_name" required />
          <Field label="Phone (WhatsApp)" name="phone" required placeholder="+234..." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" name="email" type="email" required />
          <Field label="City" name="city" required placeholder="e.g. Lagos, Ibadan" />
        </div>
        <Field label="Skills (comma-separated)" name="skills" placeholder="property verification, deliveries, document processing" />
        <Field label="Password" name="password" type="password" required placeholder="At least 8 characters" />
        <SubmitBtn />
        <p className="text-center text-xs text-bbb-slate">Already a buddy? <a href="/login" className="font-bold text-bbb-strong">Log in</a></p>
      </form>
    </AuthLayout>
  );
}
