-- 0011: client checklist/expectations + mid-task additional charges (run AFTER 0010)

-- ===== Client checklist / expectations on the request =====
alter table requests add column if not exists expectations text;

-- ===== Additional charges proposed mid-task =====
-- Lifecycle: proposed → approved → paid   (or → declined)
-- Never blocks the main request state machine; payout math may include paid extras.
create table if not exists additional_charges (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  reason text not null,
  amount_ngn numeric(14,2) not null check (amount_ngn > 0),
  buddy_extra_ngn numeric(14,2) not null default 0 check (buddy_extra_ngn >= 0),
  status text not null default 'proposed' check (status in ('proposed','approved','declined','paid')),
  proposed_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_additional_charges_request on additional_charges(request_id);

alter table additional_charges enable row level security;

-- Client may see charges on their own requests
create policy "client reads own additional charges" on additional_charges for select
using (
  exists (select 1 from requests r where r.id = additional_charges.request_id and r.client_id = auth.uid())
);

-- Client may approve/decline (only from 'proposed', only their own request)
create policy "client decides own additional charges" on additional_charges for update
using (
  status = 'proposed'
  and exists (select 1 from requests r where r.id = additional_charges.request_id and r.client_id = auth.uid())
)
with check (status in ('approved','declined'));

-- Admin writes happen via the service role (bypasses RLS), as elsewhere in the app.
