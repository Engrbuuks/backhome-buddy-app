"use client";
import React, { useState } from "react";
import { useFormState } from "react-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { signIn } from "@/lib/auth/actions";

export default function LoginForm() {
  const [show, setShow] = useState(false);
  const [state, formAction] = useFormState(signIn, { error: "" });

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to your portal"
      subtitle="Sign in to manage your requests."
    >
      {state?.error && <div className="mb-5"><ErrorState title="Login failed" message={state.error} /></div>}
      <form action={formAction} className="max-w-md space-y-4">
        <Field label="Email address" icon={Mail} type="email" name="email" required placeholder="you@example.com" />
        <div>
          <Field label="Password" icon={Lock} type={show ? "text" : "password"} name="password" required placeholder="Enter password" />
          <button type="button" onClick={() => setShow(!show)} className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-bbb-slate hover:text-bbb-strong">
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {show ? "Hide password" : "Show password"}
          </button>
        </div>
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Sign in</button>
        <p className="text-center text-sm text-bbb-slate">
          New client? <a href="/signup" className="font-bold text-bbb-strong hover:text-bbb-dark">Create an account</a>
        </p>
      </form>
    </AuthLayout>
  );
}
