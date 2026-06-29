-- 0004: USD display + admin-set FX rate (run AFTER 0003)
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
create policy "anyone reads settings" on app_settings for select using (true);
-- writes via service-role only (no write policy)
insert into app_settings (key, value) values ('fx_usd_ngn', '{"rate": 1500}');

alter table requests add column if not exists display_currency text not null default 'NGN';
alter table requests add column if not exists fx_rate numeric(12,4);
