-- 0016: capture visitor name + email on public chat threads (run AFTER 0015)
alter table chat_threads add column if not exists visitor_name text;
alter table chat_threads add column if not exists visitor_email text;
