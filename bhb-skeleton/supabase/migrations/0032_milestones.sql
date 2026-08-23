-- 0032: task milestones. Reusable per-service templates, copied to each request
-- (admin-editable per task). Each milestone is completed by a proof (photo/video)
-- plus a note. Partial submission is allowed; admin sees what's missing.

-- Reusable template milestones attached to a service type.
create table if not exists service_milestones (
  id uuid primary key default gen_random_uuid(),
  service_type_id uuid not null references service_types(id) on delete cascade,
  title text not null,
  hint text,                    -- what the buddy should capture
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists service_milestones_type_idx on service_milestones(service_type_id, sort_order);

-- The actual milestones for one request (copied from template, then tweakable).
create table if not exists request_milestones (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  title text not null,
  hint text,
  sort_order int not null default 0,
  -- completion: set when the buddy attaches a proof + note to this milestone
  done boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists request_milestones_request_idx on request_milestones(request_id, sort_order);

-- Link a proof to the milestone it satisfies (nullable: legacy proofs have none).
alter table proofs add column if not exists milestone_id uuid references request_milestones(id) on delete set null;

-- RLS
alter table service_milestones enable row level security;
alter table request_milestones enable row level security;

-- service_milestones: admins manage; everyone can read (needed to show templates).
drop policy if exists "read service milestones" on service_milestones;
create policy "read service milestones" on service_milestones for select using (true);
drop policy if exists "admin writes service milestones" on service_milestones;
create policy "admin writes service milestones" on service_milestones for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- request_milestones: the owning client, the assigned buddy, and admins can read.
drop policy if exists "read request milestones" on request_milestones;
create policy "read request milestones" on request_milestones for select using (
  exists (select 1 from requests r where r.id = request_id
    and (r.client_id = auth.uid() or r.assigned_buddy_id = auth.uid()
         or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')))
);
-- assigned buddy can update completion; admins manage fully (service role bypasses anyway).
drop policy if exists "buddy updates own request milestones" on request_milestones;
create policy "buddy updates own request milestones" on request_milestones for update using (
  exists (select 1 from requests r where r.id = request_id and r.assigned_buddy_id = auth.uid())
);
