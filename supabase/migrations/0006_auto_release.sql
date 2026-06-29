-- 0006: auto-release timer setting (run AFTER 0005)
insert into app_settings (key, value) values ('auto_release_days', '{"days": 7}')
on conflict (key) do nothing;
