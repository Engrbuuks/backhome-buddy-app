"use client";
import React, { useState, useEffect } from "react";
import { useFormState } from "react-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { updatePassword } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordForm() {
  const [show, setShow] = useState(false);
  const [state, formAction] = useFormState(updatePassword, { error: "" });
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState("");

  // Supabase recovery links land here with the session in the URL. Depending on
  // the flow, that's either a ?code= (PKCE) to exchange, or tokens in the #hash.
  // Establish the session client-side so the server action can update the password.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        const errDesc = url.searchParams.get("error_description") || hash.get("error_description");

        if (errDesc) { setLinkError(decodeURIComponent(errDesc)); return; }
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) { setLinkError("This reset link has expired or was already used. Please request a new one."); return; }
        } else if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) { setLinkError("This reset link has expired or was already used. Please request a new one."); return; }
        } else {
          // No token present — check if a valid recovery session already exists.
          const { data } = await supabase.auth.getSession();
          if (!data.session) { setLinkError("This page must be opened from the reset link in your email."); return; }
        }
        // Clean the URL so tokens aren't left in the address bar.
        window.history.replaceState({}, "", "/reset-password");
        setReady(true);
      } catch {
        setLinkError("Something went wrong opening the reset link. Please request a new one.");
      }
    })();
  }, []);

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

  if (linkError) {
    return (
      <AuthLayout eyebrow="Reset password" title="Link problem" subtitle="We couldn't verify this reset link.">
        <div className="max-w-md space-y-3 rounded-2xl border border-bbb-border bg-white p-5 text-sm leading-7 text-bbb-slate">
          <p>{linkError}</p>
          <a href="/forgot-password" className="inline-block h-11 rounded-xl bg-bbb-strong px-6 py-3 text-sm font-bold text-white hover:bg-bbb-dark">Request a new link</a>
        </div>
      </AuthLayout>
    );
  }

  if (!ready) {
    return (
      <AuthLayout eyebrow="Reset password" title="Verifying your link…" subtitle="One moment.">
        <div className="max-w-md rounded-2xl border border-bbb-border bg-white p-5 text-sm text-bbb-slate">Checking your reset link…</div>
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
