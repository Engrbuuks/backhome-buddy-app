"use client";
import React, { useState } from "react";
import { useFormState } from "react-dom";
import { Lock, Mail, User } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { signUpClient } from "@/lib/auth/actions";

export default function SignupForm() {
  const [show, setShow] = useState(false);
  const [state, formAction] = useFormState(signUpClient, { error: "" });
  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your client account"
      subtitle="Request errands back home and track them from anywhere. Buddies apply separately."
    >
      {state?.error && <div className="mb-5"><ErrorState title="Sign up failed" message={state.error} /></div>}
      {state?.ok && (
        <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
          <p className="font-display text-lg font-extrabold text-green-800">Account created</p>
          <p className="mt-1 text-sm text-green-700">{state.message}</p>
          <a href="/login" className="mt-3 inline-block rounded-xl bg-bbb-strong px-5 py-2.5 text-sm font-bold text-white hover:bg-bbb-dark">Go to sign in</a>
        </div>
      )}
      {!state?.ok && (
      <form action={formAction} className="max-w-md space-y-4">
        <Field label="Full name" icon={User} type="text" name="full_name" required placeholder="Your name" />
        <Field label="Email address" icon={Mail} type="email" name="email" required placeholder="you@example.com" />
        <Field label="Password" icon={Lock} type={show ? "text" : "password"} name="password" required placeholder="Create a password (min 8 characters)" minLength={8} />
        <button type="button" onClick={() => setShow(!show)} className="text-xs font-semibold text-bbb-slate hover:text-bbb-strong">
          {show ? "Hide" : "Show"} password
        </button>
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Create account</button>
        <p className="text-center text-sm text-bbb-slate">
          Already have an account? <a href="/login" className="font-bold text-bbb-strong hover:text-bbb-dark">Sign in</a>
        </p>
        <p className="text-center text-xs text-bbb-slate">
          Want to earn as a buddy? <a href="/apply" className="font-bold text-bbb-strong">Apply here</a>
        </p>
      </form>
      )}
    </AuthLayout>
  );
}
