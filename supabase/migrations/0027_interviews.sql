-- 0027: in-app interview records. Stores a guided interview for a candidate —
-- who may be a recruit (early pipeline) or a buddy (applied on the app). Answers,
-- per-question scores, the live proof-test result, and overall outcome are saved
-- so the interview can be reopened and reviewed later, and results sync into the
-- buddy's competency profile.

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  -- Link to whichever pipeline record this concerns (one of the two).
  recruit_id uuid,                         -- references recruits(id) if it exists
  buddy_id uuid references profiles(id) on delete cascade,
  candidate_name text,                     -- snapshot of who was interviewed
  candidate_email text,

  status text not null default 'in_progress',  -- in_progress | completed
  -- answers: JSON map of questionKey -> { score:1-5, note:string }
  answers jsonb not null default '{}'::jsonb,
  -- live proof test result
  proof_test_score int,                    -- 1-5
  proof_test_note text,
  -- competency captured during interview (mirrors buddy_profiles competency)
  comp_property int, comp_welfare int, comp_documents int, comp_purchases int,
  comp_communication int, comp_reliability int,
  coverage_note text,
  specialisms text,
  concerns text,
  approved_task_types text[],

  overall_score int,                       -- computed / entered total
  decision text,                           -- advance | trial | decline | (null)
  interviewer_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint proof_score_rng check (proof_test_score is null or proof_test_score between 1 and 5)
);

create index if not exists interviews_recruit_idx on interviews(recruit_id);
create index if not exists interviews_buddy_idx on interviews(buddy_id);
create index if not exists interviews_status_idx on interviews(status);

alter table interviews enable row level security;
drop policy if exists interviews_admin_all on interviews;
create policy interviews_admin_all on interviews
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
