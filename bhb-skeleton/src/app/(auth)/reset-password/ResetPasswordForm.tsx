"use client";
import React, { useState } from "react";
import { useFormState } from "react-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { updatePassword } from "@/lib/auth/actions";

export default function ResetPasswordForm() {
  const [show, setShow] = useState(false);
  const [state, formAction] = useFormState(updatePassword, { error: "" });

  if ((state as any)?.done) {
    return (
      <AuthLayout eyebrow="All set" title="Password updated" subtitle="Your password has been changed.">
        <div className="max-w-md space-y-3 rounded-2xl border border-bbb-border bg-white p-5 text-sm leading-7 text-bbb-slate">
          <p>You can now sign in with your new password.</p>
          <a href="/login" className="inline-block h-11 rounded-xl bg-bbb-strong px-6 py-3 text-sm font-bold text-white hover:bg-bbb-dark">Go to login</a>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Reset password" title="Choose a new password" subtitle="Enter a new password for your account.">
      {state?.error && <div className="mb-5"><ErrorState title="Could not update" message={state.error} /></div>}
      <form action={formAction} className="max-w-md space-y-4">
        <Field label="New password" icon={Lock} type={show ? "text" : "password"} name="password" required placeholder="At least 8 characters" autoComplete="new-password" />
        <Field label="Confirm new password" icon={Lock} type={show ? "text" : "password"} name="confirm" required placeholder="Re-enter password" autoComplete="new-password" />
        <button type="button" onClick={() => setShow(!show)} className="inline-flex items-center gap-2 text-xs font-semibold text-bbb-slate hover:text-bbb-strong">
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{show ? "Hide" : "Show"} passwords
        </button>
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Update password</button>
      </form>
    </AuthLayout>
  );
}
