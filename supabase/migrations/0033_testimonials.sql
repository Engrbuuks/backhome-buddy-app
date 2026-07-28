-- 0033: testimonials collected via one-time links, approved by admin, shown on
-- the WordPress marketing site through a public read-only API.

-- One-time invite tokens the admin generates for a specific person.
create table if not exists testimonial_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,               -- random, unguessable; used in the link
  invitee_name text not null,               -- who it's for (admin enters this)
  invitee_email text,
  note text,                                -- optional admin note/context
  used boolean not null default false,      -- one-time: flips true on submit
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists testimonial_invites_token_idx on testimonial_invites(token);

-- The testimonials themselves.
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid references testimonial_invites(id) on delete set null,
  author_name text not null,
  location_code text,                        -- e.g. 'GB','US','CA' (for the flag)
  location_label text,                       -- e.g. 'United Kingdom'
  rating int not null default 5 check (rating between 1 and 5),
  body text not null,
  media_url text,                            -- optional photo/video (R2 key)
  media_kind text,                           -- 'photo' | 'video' | null
  status text not null default 'pending',    -- 'pending' | 'approved' | 'rejected'
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references profiles(id)
);
create index if not exists testimonials_status_idx on testimonials(status, created_at desc);

-- RLS
alter table testimonial_invites enable row level security;
alter table testimonials enable row level security;

-- Admins manage invites.
drop policy if exists "admin manages invites" on testimonial_invites;
create policy "admin manages invites" on testimonial_invites for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Admins manage testimonials; the public read of APPROVED ones happens through a
-- server route using the service role, so no public RLS policy is needed here.
drop policy if exists "admin manages testimonials" on testimonials;
create policy "admin manages testimonials" on testimonials for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
