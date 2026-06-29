"use client";
import React from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { updateMyProfile } from "@/lib/client/actions";

export default function ProfileForm({ initial }: { initial: any }) {
  const [state, formAction] = useFormState(updateMyProfile, { error: "" });
  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
      {state?.error && <ErrorState title="Could not save" message={state.error} />}
      {(state as any)?.saved && <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">Profile saved.</div>}
      <Field label="Full name" name="full_name" defaultValue={initial?.full_name ?? ""} />
      <Field label="Phone" name="phone" defaultValue={(initial as any)?.phone ?? ""} placeholder="+234..." />
      <Field label="Email" value={initial?.email ?? ""} disabled readOnly />
      <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save profile</button>
    </form>
  );
}
