"use client";
import React from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/FormControls";
import { StatusPill, statusLabel } from "@/components/StatusPill";
import { ErrorState } from "@/components/StateBlocks";
import { updateMyProfile } from "@/lib/client/actions";
import { updateBuddySkills } from "@/lib/buddy/actions";

export default function BuddyProfileForm({ profile, buddy }: { profile: any; buddy: any }) {
  const [pState, pAction] = useFormState(updateMyProfile, { error: "" });
  const [sState, sAction] = useFormState(updateBuddySkills, { error: "" });
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">My profile</h1>
        <StatusPill status={statusLabel(buddy?.vetting ?? "applied")} />
      </div>
      <form action={pAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        {pState?.error && <ErrorState title="Could not save" message={pState.error} />}
        {(pState as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Saved.</div>}
        <Field label="Full name" name="full_name" defaultValue={profile?.full_name ?? ""} />
        <Field label="Phone" name="phone" defaultValue={profile?.phone ?? ""} />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save</button>
      </form>
      <form action={sAction} className="mt-5 space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        {sState?.error && <ErrorState title="Could not save" message={sState.error} />}
        {(sState as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Skills saved.</div>}
        <Field label="Skills (comma-separated)" name="skills" defaultValue={(buddy?.skills ?? []).join(", ")} placeholder="property verification, deliveries, document processing" />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save skills</button>
      </form>
    </div>
  );
}
