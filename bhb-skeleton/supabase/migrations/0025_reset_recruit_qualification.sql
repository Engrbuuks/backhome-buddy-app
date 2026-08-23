-- 0025: (1) ensure the two-stage columns exist (in case only the original
-- single-stage 0024 was run), then (2) reset auto-qualified recruits.
-- No one qualifies for interview until they re-apply on the app and are reviewed.

-- (1) Add any missing columns from the two-stage flow. Safe if already present.
alter table recruits
  add column if not exists invited_to_apply_at timestamptz,
  add column if not exists applied_at timestamptz,
  add column if not exists interview_invited_at timestamptz,
  add column if not exists registered_at timestamptz;

-- The original table may also have had an 'invited_at' column; keep it, harmless.

-- (2) Reset. Anyone qualified/interview-invited who has NOT registered on the
-- app → back to 'new'. Those who HAVE registered → 'applied' for review.
update recruits r
set status = 'new', applied_at = null, interview_invited_at = null
where r.status in ('qualified', 'invited', 'invited_to_interview')
  and not exists (select 1 from profiles p where lower(p.email) = lower(r.email));

update recruits r
set status = 'applied', interview_invited_at = null
where r.status in ('qualified', 'invited', 'invited_to_interview')
  and exists (select 1 from profiles p where lower(p.email) = lower(r.email));
