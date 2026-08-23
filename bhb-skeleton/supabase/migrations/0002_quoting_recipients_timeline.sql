-- 0002: saved recipients + request timeline (run AFTER 0001)

create table saved_recipients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  phone text, address text, notes text,
  created_at timestamptz not null default now()
);
alter table saved_recipients enable row level security;
create policy "client manages own recipients" on saved_recipients
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());

create table request_timeline (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  from_status request_status,
  to_status request_status not null,
  actor_id uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);
alter table request_timeline enable row level security;
create policy "timeline visible with request" on request_timeline for select using (
  exists (select 1 from requests r where r.id = request_id
    and (r.client_id = auth.uid() or r.assigned_buddy_id = auth.uid() or auth_role() = 'admin'))
);
-- inserts happen via service-role only (no insert policy)
