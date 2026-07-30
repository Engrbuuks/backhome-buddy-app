-- 0036: chat attachments. A message can carry one file (image/video/document).
-- The file itself lives in R2 (proofs bucket, "chat-<request>" scope); we store
-- the key + a little metadata so it can be signed and rendered.

alter table request_messages add column if not exists attachment_url text;   -- R2 key
alter table request_messages add column if not exists attachment_kind text;  -- 'image' | 'video' | 'file'
alter table request_messages add column if not exists attachment_name text;  -- original filename (for documents)
