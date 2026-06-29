-- 0010: coverage zones + published "from" pricing (run AFTER 0009)
-- State + zone model: regions = where we operate; zone = pricing tier.
--   Zone A = major metros (base from-price)
--   Zone B = other covered states (from-price + uplift %)
-- Remote LGAs anywhere remain individually quoted via the normal quote step.

-- ===== Regions get a pricing zone =====
alter table regions add column if not exists zone text not null default 'B';
alter table regions drop constraint if exists regions_zone_check;
alter table regions add constraint regions_zone_check check (zone in ('A','B'));

-- ===== Services get a pricing mode + Zone-A "from" price in USD =====
-- pricing_mode: 'from'  → show "from $X" (zone-adjusted)
--               'quote' → show "Priced per task — free quote within 24 hours."
alter table service_types add column if not exists pricing_mode text not null default 'quote';
alter table service_types drop constraint if exists service_types_pricing_mode_check;
alter table service_types add constraint service_types_pricing_mode_check check (pricing_mode in ('from','quote'));
alter table service_types add column if not exists from_price_usd numeric(10,2) not null default 0;

-- ===== Requests can capture out-of-coverage demand ("Another state") =====
alter table requests add column if not exists requested_state text;

-- ===== Global Zone-B uplift (%) — admin-editable on the Services page =====
insert into app_settings (key, value)
values ('pricing_zone_b_uplift_pct', '{"pct": 25}'::jsonb)
on conflict (key) do nothing;

-- ===== Seed the 12 launch states (skips any name that already exists) =====
insert into regions (name, state, zone, active)
select v.name, v.name, v.zone, true
from (values
  ('Lagos',        'A'),
  ('Abuja (FCT)',  'A'),
  ('Ogun',         'B'),
  ('Oyo',          'B'),
  ('Osun',         'B'),
  ('Ekiti',        'B'),
  ('Edo',          'B'),
  ('Delta',        'B'),
  ('Enugu',        'B'),
  ('Anambra',      'B'),
  ('Imo',          'B'),
  ('Abia',         'B')
) as v(name, zone)
where not exists (select 1 from regions r where lower(r.name) = lower(v.name));
