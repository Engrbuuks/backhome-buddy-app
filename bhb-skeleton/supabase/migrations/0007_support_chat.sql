-- 0007: AI support chat (run AFTER 0006)
create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  sender text not null check (sender in ('user','assistant','staff')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table chat_threads enable row level security;
alter table chat_messages enable row level security;
create policy "own thread read" on chat_threads for select using (user_id = auth.uid());
create policy "own thread create" on chat_threads for insert with check (user_id = auth.uid());
create policy "own messages read" on chat_messages for select using (
  exists (select 1 from chat_threads t where t.id = thread_id and t.user_id = auth.uid())
);
create policy "own user messages insert" on chat_messages for insert with check (
  sender = 'user' and exists (select 1 from chat_threads t where t.id = thread_id and t.user_id = auth.uid())
);
-- assistant/staff messages + admin reads happen via service role
