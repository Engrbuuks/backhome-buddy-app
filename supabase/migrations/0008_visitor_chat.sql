-- 0008: anonymous visitor chat for public pages (run AFTER 0007)
alter table chat_threads alter column user_id drop not null;
alter table chat_threads add column if not exists visitor_key text unique;
-- No new RLS policies: visitor traffic goes only through server actions (service role).
