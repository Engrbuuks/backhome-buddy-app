-- 0042: client initiated refund requests, with a stage based non refundable amount.
-- Run AFTER 0041. Idempotent: safe to run twice.
--
-- WHY THIS EXISTS
--
-- Until now a client had two ways to get money back and neither of them was
-- called a refund. "Cancel request" worked only before a buddy was assigned and
-- captured no reason. "Raise an issue" opened a dispute and only after work had
-- started. Between the two sat `assigned`, where the client had no button at
-- all. This table gives the client one honest action at every stage that holds
-- money, and gives the admin the reason, the stage and the arithmetic in one
-- place.
--
-- WHAT THE NON REFUNDABLE AMOUNT IS FOR
--
-- Once a buddy accepts a task the cost is real: they have turned down other
-- work, and often already moved. Retaining a slice at that point is what stops
-- a free option on somebody else's day. Three rules keep it fair, and all three
-- are enforced in code, not left to memory:
--
--   1. Nothing is retained before a buddy is assigned. No buddy, no cost.
--   2. Nothing is retained when the failure is ours or the buddy's. The
--      non refundable amount is for a client who changed their mind, not for a
--      task we could not deliver.
--   3. The admin can override the computed figure on any single decision, and
--      both the computed figure and the override are stored, so the exception
--      is visible as an exception.

create table if not exists refund_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  raised_by uuid not null references profiles(id),

  reason text not null,
  -- A coarse bucket on top of the free text, so the queue can be read at a
  -- glance and so patterns (one buddy generating all the complaints) surface.
  reason_code text not null default 'other',

  -- open | approved | declined | withdrawn
  status text not null default 'open',

  -- SNAPSHOT at the moment of asking. Prices and statuses move; what the client
  -- was told when they pressed the button must not move with them.
  request_status_at_request text,
  paid_ngn numeric(12,2),
  policy_retained_ngn numeric(12,2),
  policy_basis text,

  -- THE DECISION
  -- client | ours | buddy | external. Only 'client' and 'external' can carry a
  -- retention; the other two waive it, which is rule 2 above.
  fault text,
  retained_ngn numeric(12,2),
  refunded_ngn numeric(12,2),
  decision_note text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  auto_approved boolean not null default false,

  created_at timestamptz not null default now()
);

do $$ begin
  alter table refund_requests add constraint refund_requests_status_known
    check (status in ('open','approved','declined','withdrawn'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table refund_requests add constraint refund_requests_fault_known
    check (fault is null or fault in ('client','ours','buddy','external'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table refund_requests add constraint refund_requests_amounts_sane
    check (
      (retained_ngn is null or retained_ngn >= 0) and
      (refunded_ngn is null or refunded_ngn >= 0)
    );
exception when duplicate_object then null; end $$;

-- One live request at a time. Without this a client can press the button five
-- times and an admin sees five identical rows to decide separately.
create unique index if not exists refund_requests_one_open_per_request
  on refund_requests (request_id) where status = 'open';

create index if not exists refund_requests_queue_idx
  on refund_requests (status, created_at);

alter table refund_requests enable row level security;

-- Belt and braces: the server actions go through the service role, which
-- bypasses RLS entirely. These policies mean that if a client key ever reaches
-- this table directly, it still only sees its owner's rows.
do $$ begin
  create policy "client reads own refund requests" on refund_requests
    for select using (raised_by = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "client raises own refund request" on refund_requests
    for insert with check (raised_by = auth.uid());
exception when duplicate_object then null; end $$;

-- THE POLICY ITSELF
--
-- Stored as settings rather than as a table because it is one small document
-- that is read on every quote and edited rarely, and because app_settings is
-- already how this app keeps tunables (fx rate, offer mode, bank list).
--
-- pct       percentage of the amount paid that is NOT refunded at that stage
-- floor_ngn a minimum in naira, so a small task still covers the cost of
--           sending somebody. Always clamped to the amount paid, so a floor can
--           never exceed what the client handed over.
insert into app_settings (key, value)
values ('refund_policy', '{
  "enabled": true,
  "auto_approve_unassigned": true,
  "waive_when_our_fault": true,
  "stages": {
    "paid":           { "pct": 0,   "floor_ngn": 0 },
    "assigned":       { "pct": 10,  "floor_ngn": 1000 },
    "in_progress":    { "pct": 25,  "floor_ngn": 2000 },
    "proof_ready":    { "pct": 100, "floor_ngn": 0 },
    "proof_approved": { "pct": 100, "floor_ngn": 0 },
    "completed":      { "pct": 100, "floor_ngn": 0 }
  }
}'::jsonb)
on conflict (key) do nothing;

comment on table refund_requests is
  'Client initiated refund requests. policy_retained_ngn is what the published '
  'rules computed; retained_ngn is what the admin actually decided. Keeping '
  'both is what makes an override auditable rather than invisible.';

comment on column refund_requests.fault is
  'Who the failure belongs to. ours and buddy force a full refund regardless '
  'of stage: the non refundable amount is never charged for our own failure.';
