-- 0020: two-way message thread attached to each request (client <-> team).
-- Separate from the website support chat (chat_threads). Both the request's
-- client and admins can read/write; delivery notifications reuse notifications.

create table if not exists request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  sender text not null check (sender in ('client','staff')),
  sender_id uuid references profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists request_messages_request_idx on request_messages(request_id, created_at);

alter table request_messages enable row level security;

-- The request's client can read/insert their own request's messages.
create policy "client reads own request messages" on request_messages
  for select using (
    exists (select 1 from requests r where r.id = request_id and r.client_id = auth.uid())
  );
create policy "client sends on own request" on request_messages
  for insert with check (
    sender = 'client'
    and sender_id = auth.uid()
    and exists (select 1 from requests r where r.id = request_id and r.client_id = auth.uid())
  );

-- Admins do everything (service role bypasses RLS anyway; this covers authed admin reads).
create policy "admin reads all request messages" on request_messages
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
