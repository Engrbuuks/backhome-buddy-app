"use client";
import React from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/FormControls";
import ProfileGeoFields from "@/components/ProfileGeoFields";
import { StatusPill, statusLabel } from "@/components/StatusPill";
import { ErrorState } from "@/components/StateBlocks";
import { updateMyProfile } from "@/lib/client/actions";
import { updateBuddySkills, updateBuddyDetails } from "@/lib/buddy/actions";
import { PassportPhotoUploader } from "@/components/PassportPhotoUploader";

const GRAD_YEARS = Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => new Date().getFullYear() - i);

function initials(name?: string) {
  if (!name) return "B";
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}
function ReadRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-bbb-slate">{label}</span>
      <span className="text-right font-semibold">{value || "—"}</span>
    </div>
  );
}

export default function BuddyProfileForm({ profile, buddy, photoUrl }: { profile: any; buddy: any; photoUrl?: string }) {
  const [pState, pAction] = useFormState(updateMyProfile, { error: "" });
  const [sState, sAction] = useFormState(updateBuddySkills, { error: "" });
  const [dState, dAction] = useFormState(updateBuddyDetails, { error: "" });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">My profile</h1>
        <StatusPill status={statusLabel(buddy?.vetting ?? "applied")} />
      </div>

      {/* Passport photo */}
      <div className="mb-5 flex items-center gap-4 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        {photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photoUrl} alt="Your photo" className="h-20 w-20 shrink-0 rounded-full border border-bbb-border object-cover" />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-bbb-bg text-xl font-extrabold text-bbb-strong">{initials(profile?.full_name)}</div>
        )}
        <div>
          <p className="font-display text-lg font-extrabold">{profile?.full_name}</p>
          <p className="text-xs text-bbb-slate">This photo shows on your dashboard.</p>
          <div className="mt-2"><PassportPhotoUploader buddyId={buddy?.id} currentUrl={photoUrl} /></div>
        </div>
      </div>

      {/* Account (name + phone) */}
      <form action={pAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <p className="font-display text-base font-extrabold">Account</p>
        {pState?.error && <ErrorState title="Could not save" message={pState.error} />}
        {(pState as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Saved.</div>}
        <Field label="Full name" name="full_name" defaultValue={profile?.full_name ?? ""} />
        <Field label="Phone" name="phone" defaultValue={profile?.phone ?? ""} />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save</button>
      </form>

      {/* Editable buddy details (pre-filled from application) */}
      <form action={dAction} className="mt-5 space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <p className="font-display text-base font-extrabold">My details</p>
        <p className="-mt-2 text-xs text-bbb-slate">Keep these up to date so we can match you to the right tasks.</p>
        {dState?.error && <ErrorState title="Could not save" message={dState.error} />}
        {(dState as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Details saved.</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" name="city" defaultValue={buddy?.city ?? ""} />
          <Field label="Occupation" name="occupation" defaultValue={buddy?.occupation ?? ""} />
        </div>
        <ProfileGeoFields
          state={buddy?.state ?? ""}
          lga={buddy?.lga ?? ""}
          coverage={Array.isArray(buddy?.coverage_areas) ? buddy.coverage_areas : (buddy?.coverage_areas ? String(buddy.coverage_areas).split(/[;,]/).map((s: string) => s.trim()).filter(Boolean) : [])}
        />
        <div>
          <label className="mb-1 block text-sm font-bold text-bbb-charcoal">Availability</label>
          <select name="availability" defaultValue={buddy?.availability ?? ""} className="h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong">
            <option value="">Select…</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="weekends">Weekends</option>
            <option value="flexible">Flexible</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold text-bbb-charcoal">Experience</label>
          <textarea name="experience" defaultValue={buddy?.experience ?? ""} rows={3} className="w-full rounded-xl border border-bbb-border bg-white p-3 text-sm outline-none focus:border-bbb-strong" placeholder="Briefly describe relevant experience." />
        </div>
        <p className="pt-1 text-sm font-extrabold">Education</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-bbb-charcoal">Highest level of education</label>
            <select name="education_level" defaultValue={buddy?.education_level ?? ""} className="h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong">
              <option value="">Select level</option>
              <option value="PhD">PhD</option>
              <option value="MSc">MSc</option>
              <option value="BSc">BSc</option>
              <option value="HND">HND</option>
              <option value="OND">OND</option>
              <option value="SSCE">SSCE</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-bbb-charcoal">Year of graduation</label>
            <select name="year_of_graduation" defaultValue={buddy?.year_of_graduation ?? ""} className="h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong">
              <option value="">Select year</option>
              {GRAD_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Course of study" name="course_of_study" defaultValue={buddy?.course_of_study ?? ""} placeholder="e.g. Estate Management" />
          <Field label="School attended" name="school_attended" defaultValue={buddy?.school_attended ?? ""} placeholder="e.g. University of Lagos" />
        </div>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="has_smartphone" defaultChecked={Boolean(buddy?.has_smartphone)} className="h-4 w-4 accent-[#079516]" /> I have a smartphone</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="can_drive" defaultChecked={Boolean(buddy?.can_drive)} className="h-4 w-4 accent-[#079516]" /> I can drive</label>
        </div>
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save details</button>
      </form>

      {/* Skills */}
      <form action={sAction} className="mt-5 space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <p className="font-display text-base font-extrabold">Skills</p>
        {sState?.error && <ErrorState title="Could not save" message={sState.error} />}
        {(sState as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Skills saved.</div>}
        <Field label="Skills (comma-separated)" name="skills" defaultValue={(buddy?.skills ?? []).join(", ")} placeholder="property verification, deliveries, document processing" />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save skills</button>
      </form>

      {/* Read-only verification info */}
      <div className="mt-5 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <p className="font-display text-base font-extrabold">Verification information</p>
        <p className="-mt-1 mb-3 text-xs text-bbb-slate">These are locked. To correct anything here, contact the team.</p>
        <ReadRow label="NIN" value={buddy?.nin} />
        <ReadRow label="Date of birth" value={buddy?.date_of_birth} />
        <ReadRow label="Address" value={buddy?.address} />
        <ReadRow label="Vetting status" value={statusLabel(buddy?.vetting ?? "applied")} />
        <ReadRow label="NDA signed" value={buddy?.nda_signed_at ? `Yes — ${new Date(buddy.nda_signed_at).toLocaleDateString()}` : "Not yet"} />
      </div>
    </div>
  );
}
