-- 0026: buddy competency profile (from the interview scorecard) + task-fit matching.
-- Lets admins record what each buddy is good at, so tasks can be matched to the
-- right buddy on evidence — essential when buddies are never met in person.

alter table buddy_profiles
  add column if not exists proof_test_score int,          -- 1-5 live proof test (gate)
  add column if not exists comp_property int,             -- 1-5 task-type competency
  add column if not exists comp_welfare int,
  add column if not exists comp_documents int,
  add column if not exists comp_purchases int,
  add column if not exists comp_communication int,        -- 1-5 comms clarity
  add column if not exists comp_reliability int,          -- 1-5 reliability signal
  add column if not exists competency_specialisms text,   -- free text: standout strengths
  add column if not exists competency_notes text,         -- watch-outs / concerns
  add column if not exists competency_assessed_at timestamptz,
  add column if not exists competency_assessed_by uuid references profiles(id) on delete set null,
  add column if not exists approved_task_types text[];    -- e.g. {property,welfare} — what they're cleared for

-- Optional constraint: scores are 1-5 when set.
do $$ begin
  alter table buddy_profiles add constraint proof_test_score_range check (proof_test_score is null or proof_test_score between 1 and 5);
exception when duplicate_object then null; end $$;
