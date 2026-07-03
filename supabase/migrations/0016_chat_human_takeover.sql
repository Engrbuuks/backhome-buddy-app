-- 0016: let a human take over a chat and silence the AI in that thread.
-- When a staff member replies, the thread is flagged human-handled and the
-- website AI stops auto-replying until handed back.

alter table chat_threads
  add column if not exists ai_enabled boolean not null default true;

-- Existing threads keep AI on; any thread a staff message already exists in
-- should be treated as human-handled so the AI doesn't resume unexpectedly.
update chat_threads t
set ai_enabled = false
where exists (select 1 from chat_messages m where m.thread_id = t.id and m.sender = 'staff');
