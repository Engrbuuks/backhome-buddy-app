-- 0038: trust tiers, optional identity verification, and buddy capacity.
--
-- NOTE ON NUMBERING: 0037 is deliberately left free. It is reserved for
-- 0037_rate_limits.sql from the earlier seven-fixes build, which was never
-- deployed. If you apply that build later it keeps its number and there is no
-- clash. A gap in the sequence is harmless; two files with the same number is
-- not. Run this AFTER 0036.
--
-- WHY THIS EXISTS
--
-- 1. The vetting model grades SKILL (property, welfare, documents, purchases)
--    but has no concept of EXPOSURE. Collecting a certificate and inspecting
--    land before a client wires millions are graded the same way today, and a
--    welfare visit to someone vulnerable is not modelled at all. trust_tier
--    adds that second axis.
--
-- 2. Buddies handling client cash is the largest fraud surface in this model.
--    handles_cash marks those service types so the flow can route payment to
--    the vendor directly instead.
--
-- 3. Paid identity verification (NIN lookup, face match) must stay OPTIONAL and
--    vendor agnostic. identity_checks records an outcome whether it came from a
--    paid API or an admin eyeballing a selfie, so the audit trail is the same
--    either way and you can switch providers, or use none at all, without a
--    schema change.
--
-- 4. Auto assignment later needs to know whether a buddy is taking work and how
--    much they are already holding. accepting_work and max_concurrent_tasks are
--    the inputs; tasks_completed is the first piece of real performance history.
--
-- Every statement is idempotent. Safe to re-run.

-- ── 1. Trust tier on service types ────────────────────────────────────────

do $$ begin
  create type trust_tier as enum ('standard', 'high_value', 'safeguarding');
exception when duplicate_object then null; end $$;

comment on type trust_tier is
  'Exposure level of a task, independent of skill. standard = low consequence. '
  'high_value = large sums or irreversible decisions (land inspection, major purchase). '
  'safeguarding = contact with a vulnerable person (elderly welfare visit, minors).';

alter table service_types
  add column if not exists trust_tier trust_tier not null default 'standard',
  -- Minimum completed tasks before a buddy may be offered this service type.
  add column if not exists min_completed_tasks int not null default 0,
  -- True where the buddy would otherwise receive client funds. Where true, pay
  -- the vendor directly; the buddy coordinates and documents but holds no cash.
  add column if not exists handles_cash boolean not null default false;

do $$ begin
  alter table service_types add constraint min_completed_tasks_sane
    check (min_completed_tasks >= 0 and min_completed_tasks <= 500);
exception when duplicate_object then null; end $$;

-- ── 2. Buddy capacity, availability and first performance counter ─────────

alter table buddy_profiles
  -- Highest exposure this buddy is cleared for. Everyone starts at standard.
  -- Raising it is a separate, deliberate act that demands the stricter checks,
  -- which is how "verify at the point of risk" is enforced in practice.
  add column if not exists clearance_tier trust_tier not null default 'standard',
  -- Buddy's own switch. They control it; nothing is offered while it is false.
  add column if not exists accepting_work boolean not null default true,
  -- How many live tasks this buddy may hold at once.
  add column if not exists max_concurrent_tasks int not null default 3,
  -- Lifetime completed count. Maintained by the app, not by hand.
  add column if not exists tasks_completed int not null default 0,
  add column if not exists last_task_at timestamptz;

do $$ begin
  alter table buddy_profiles add constraint max_concurrent_sane
    check (max_concurrent_tasks between 1 and 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table buddy_profiles add constraint tasks_completed_sane
    check (tasks_completed >= 0);
exception when duplicate_object then null; end $$;

-- Backfill the counter from history so existing buddies are not treated as new.
do $$
begin
  if not exists (select 1 from app_settings where key = 'migration_0038_backfilled') then
    update buddy_profiles b
    set tasks_completed = sub.n,
        last_task_at    = sub.latest
    from (
      select assigned_buddy_id as bid, count(*) as n, max(updated_at) as latest
      from requests
      where status = 'completed' and assigned_buddy_id is not null
      group by assigned_buddy_id
    ) sub
    where b.id = sub.bid;

    insert into app_settings (key, value)
    values ('migration_0038_backfilled', '{"done": true}'::jsonb)
    on conflict (key) do nothing;
  end if;
end $$;

/**
 * Increment a buddy's completed count atomically.
 *
 * Done in SQL rather than read-modify-write in the app, so two completions
 * landing at the same moment cannot both read the same stale number. Callers
 * treat a failure here as non fatal: the counter is useful, but it must never
 * block a client from confirming their task.
 */
create or replace function public.bump_buddy_completed(p_buddy uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update buddy_profiles
  set tasks_completed = tasks_completed + 1,
      last_task_at    = now()
  where id = p_buddy;
$$;

revoke all on function public.bump_buddy_completed(uuid) from public, anon, authenticated;
grant execute on function public.bump_buddy_completed(uuid) to service_role;

-- ── 2b. Grandfather buddies who were already approved ────────────────────
--
-- The checklist gains two new checks that block at standard tier
-- (bank_name_match, trial_task_passed). Without this, a buddy approved under
-- the old checklist would fail re-approval the moment they were unsuspended,
-- because checks that did not exist when they were vetted would show as
-- outstanding.
--
-- They are marked ticked with an explicit note saying why, so nobody later
-- mistakes a grandfathered tick for evidence that the check was actually
-- performed. New applicants get no such pass.

do $$
begin
  if not exists (select 1 from app_settings where key = 'migration_0038_grandfathered') then
    update buddy_profiles
    set vetting_checks = coalesce(vetting_checks, '{}'::jsonb)
                         || '{"bank_name_match": true, "trial_task_passed": true}'::jsonb,
        vetting_notes  = concat_ws(
          E'\n',
          nullif(vetting_notes, ''),
          'Grandfathered on ' || to_char(now(), 'YYYY-MM-DD') ||
          ': approved before the bank name match and trial proof task were introduced. ' ||
          'These two ticks are carried over, NOT evidence that either check was performed.'
        )
    where vetting = 'approved';

    insert into app_settings (key, value)
    values ('migration_0038_grandfathered', '{"done": true}'::jsonb)
    on conflict (key) do nothing;
  end if;
end $$;

-- ── 3. Identity checks: optional, vendor agnostic, auditable ──────────────

create table if not exists identity_checks (
  id uuid primary key default gen_random_uuid(),
  buddy_id uuid not null references profiles(id) on delete cascade,
  -- What was checked.
  check_type text not null,
  -- Who or what performed it. 'manual' means an admin compared it by eye,
  -- which is a first class option, not a fallback.
  provider text not null default 'manual',
  -- pass | fail | inconclusive
  outcome text not null,
  -- Raw provider response, or the admin's note. Never trusted as instructions.
  result jsonb not null default '{}'::jsonb,
  -- What this check cost, in kobo. Lets you answer later whether paying for the
  -- automated version beats the manual one.
  cost_kobo int not null default 0,
  performed_by uuid references profiles(id) on delete set null,
  performed_at timestamptz not null default now()
);

do $$ begin
  alter table identity_checks add constraint identity_check_type_known
    check (check_type in ('bank_account_name','nin','bvn','face_match','document','selfie_manual','phone_otp','guarantor_form'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table identity_checks add constraint identity_outcome_known
    check (outcome in ('pass','fail','inconclusive'));
exception when duplicate_object then null; end $$;

create index if not exists identity_checks_buddy_idx on identity_checks (buddy_id, performed_at desc);

-- Service role only. Identity results are never readable by clients or buddies.
alter table identity_checks enable row level security;

comment on table identity_checks is
  'Append only record of identity verification attempts. provider = manual is a '
  'valid, zero cost outcome: paid vendors are optional and swappable.';
