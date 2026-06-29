-- 0012: urgent priority surcharge setting (run AFTER 0011)
insert into app_settings (key, value)
values ('pricing_urgent_surcharge_pct', '{"pct": 40}'::jsonb)
on conflict (key) do nothing;
