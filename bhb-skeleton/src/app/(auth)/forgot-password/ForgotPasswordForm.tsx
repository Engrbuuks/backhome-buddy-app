"use client";
import React from "react";
import { useFormState } from "react-dom";
import { Mail } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { requestPasswordReset } from "@/lib/auth/actions";

export default function ForgotPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordReset, { error: "" });

  if ((state as any)?.done) {
    return (
      <AuthLayout eyebrow="Check your email" title="Reset link sent" subtitle="If an account exists for that email, a password-reset link is on its way.">
        <div className="max-w-md space-y-3 rounded-2xl border border-bbb-border bg-white p-5 text-sm leading-7 text-bbb-slate">
          <p>Open the email from Backhome Buddy and click <span className="font-semibold text-bbb-charcoal">Choose a new password</span>. The link expires shortly for your security.</p>
          <p>Didn&apos;t get it? Check spam, or <a href="/forgot-password" className="font-bold text-bbb-strong">try again</a>.</p>
          <a href="/login" className="inline-block font-bold text-bbb-strong">Back to login →</a>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Forgot password" title="Reset your password" subtitle="Enter your email and we'll send you a link to set a new password.">
      {state?.error && <div className="mb-5"><ErrorState title="Could not send" message={state.error} /></div>}
      <form action={formAction} className="max-w-md space-y-4">
        <Field label="Email address" icon={Mail} type="email" name="email" required placeholder="you@example.com" />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Send reset link</button>
        <p className="text-center text-sm text-bbb-slate">Remembered it? <a href="/login" className="font-bold text-bbb-strong hover:text-bbb-dark">Back to login</a></p>
      </form>
    </AuthLayout>
  );
}
