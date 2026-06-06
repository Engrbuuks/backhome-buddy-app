-- 0013: client-facing completion report (run AFTER 0012)
alter table requests add column if not exists report text;
