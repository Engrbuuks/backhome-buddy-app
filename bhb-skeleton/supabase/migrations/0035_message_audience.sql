-- 0035: message audience + who can see each message.
-- Lets admins target a message to the client only, the buddy only, or everyone.
-- Default 'all' preserves existing three-way behaviour for every current row.

alter table request_messages add column if not exists audience text not null default 'all';
-- allowed: 'all' | 'client' | 'buddy'  (staff/admin always sees everything)

-- (Formatting is stored inline in content as lightweight markdown; no schema
--  change needed for that.)
