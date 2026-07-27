-- 0029: per-client preferred display currency. Rates and bank details live in
-- app_settings (key -> JSON) so no new tables are needed for those.

alter table profiles
  add column if not exists preferred_currency text;  -- 'USD' | 'GBP' | 'EUR' | 'CAD' | 'NGN' | null(=default)
