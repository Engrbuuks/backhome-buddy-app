-- 0016b: let a human take over a chat and silence the AI in that thread.
--
-- RENUMBERED. This file was previously also numbered 0016, clashing with
-- 0016_visitor_identity.sql. The two touch different columns, so the order
-- between them never mattered — the clash was a bookkeeping hazard, not a bug.
--
-- SAFE TO RE-RUN. The column add is `if not exists`, and the one-time backfill
-- below is now guarded by a marker row, so it can never be applied twice (which
-- would otherwise re-silence the AI in threads you had deliberately handed back).
--
-- When a staff member replies, the thread is flagged human-handled and the
-- website AI stops auto-replying until handed back.

alter table chat_threads
  add column if not exists ai_enabled boolean not null default true;

-- One-time backfill: any thread that ALREADY had a staff message when this
-- migration first ran should be treated as human-handled, so the AI doesn't
-- resume unexpectedly. Guarded so it only ever runs once.
do $$
begin
  if not exists (select 1 from app_settings where key = 'migration_0016b_backfilled') then
    update chat_threads t
    set ai_enabled = false
    where exists (select 1 from chat_messages m where m.thread_id = t.id and m.sender = 'staff');

    insert into app_settings (key, value)
    values ('migration_0016b_backfilled', '{"done": true}'::jsonb)
    on conflict (key) do nothing;
  end if;
end $$;
