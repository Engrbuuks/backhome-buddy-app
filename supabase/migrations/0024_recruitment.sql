-- 0024: recruitment pipeline. Stores prospective buddies loaded from CSV/paste,
-- their qualification status, and interview-invite tracking. The Calendly
-- interview invite can only be sent to someone marked 'qualified'.

create table if not exists recruits (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  state text,
  city text,
  occupation text,
  availability text,
  coverage text,
  strengths text,
  tier text,                       -- 'A' | 'B' | 'C' from the assessment (optional)
  status text not null default 'new',   -- new | qualified | invited | registered | rejected
  invited_at timestamptz,
  registered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);

-- Prevent duplicate loads of the same person (by email or phone).
create unique index if not exists recruits_email_uniq on recruits (lower(email)) where email is not null and email <> '';
create unique index if not exists recruits_phone_uniq on recruits (phone) where phone is not null and phone <> '';

create index if not exists recruits_status_idx on recruits (status);
create index if not exists recruits_tier_idx on recruits (tier);

-- RLS: admins only.
alter table recruits enable row level security;

drop policy if exists recruits_admin_all on recruits;
create policy recruits_admin_all on recruits
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
