-- Backhome Buddy — initial schema + RLS
-- Run in Supabase (SQL editor or `supabase db push`). See ARCHITECTURE.md §5.

-- ===== ENUMS =====
create type user_role as enum ('client','buddy','admin');
create type request_status as enum (
  'draft','submitted','quoted','awaiting_pay','paid','assigned',
  'in_progress','proof_ready','proof_approved','completed','paid_out',
  'cancelled','refunded','disputed'
);
create type buddy_vetting as enum ('applied','under_review','approved','rejected','suspended');
create type payment_status as enum ('pending','succeeded','failed','refunded','partial_refund');
create type payout_status  as enum ('pending','processing','paid','failed');
create type payment_provider as enum ('paystack','flutterwave');
create type proof_kind as enum ('photo','video','report');
create type txn_kind as enum ('payment','payout','refund');

-- ===== PROFILES =====
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  full_name text, phone text, email text,
  created_at timestamptz not null default now()
);

create table buddy_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  vetting buddy_vetting not null default 'applied',
  coverage_region_ids uuid[] default '{}',
  skills text[] default '{}',
  id_document_url text,
  bank_name text, bank_account_number text, bank_account_name text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ===== NO-CODE CONFIG =====
create table service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text,
  base_price_ngn numeric(12,2) not null default 0,
  default_buddy_payout_pct numeric(5,2) not null default 60,
  active boolean not null default true, sort_order int default 0
);
create table regions (
  id uuid primary key default gen_random_uuid(),
  name text not null, state text, active boolean not null default true
);

-- ===== REQUESTS =====
create table requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id),
  service_type_id uuid references service_types(id),
  region_id uuid references regions(id),
  status request_status not null default 'submitted',
  title text, description text, urgency text,
  recipient_name text, recipient_phone text, recipient_address text,
  client_price_ngn numeric(12,2), buddy_payout_ngn numeric(12,2),
  assigned_buddy_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table quote_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  label text not null, amount_ngn numeric(12,2) not null
);
create table proofs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  buddy_id uuid not null references profiles(id),
  kind proof_kind not null, file_url text, note text,
  created_at timestamptz not null default now()
);

-- ===== MONEY =====
create table payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id),
  client_id uuid not null references profiles(id),
  provider payment_provider not null,
  provider_reference text unique,
  amount_ngn numeric(12,2) not null,
  status payment_status not null default 'pending',
  funds_held boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table payouts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id),
  buddy_id uuid not null references profiles(id),
  provider payment_provider not null,
  provider_reference text unique,
  amount_ngn numeric(12,2) not null,
  status payout_status not null default 'pending',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id),
  request_id uuid not null references requests(id),
  amount_ngn numeric(12,2) not null, reason text,
  provider_reference text unique,
  status payment_status not null default 'pending',
  created_at timestamptz not null default now()
);
create table transactions (
  id uuid primary key default gen_random_uuid(),
  kind txn_kind not null,
  request_id uuid references requests(id),
  payment_id uuid references payments(id),
  payout_id uuid references payouts(id),
  refund_id uuid references refunds(id),
  amount_ngn numeric(12,2) not null, note text,
  created_at timestamptz not null default now()
);

-- ===== SUPPORT =====
create table disputes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id),
  raised_by uuid not null references profiles(id),
  reason text not null, resolution text, resolved_outcome text,
  status text not null default 'open',
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  title text not null, body text, link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null, target_id uuid, detail jsonb,
  created_at timestamptz not null default now()
);

-- ===== RLS =====
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

alter table profiles enable row level security;
alter table buddy_profiles enable row level security;
alter table service_types enable row level security;
alter table regions enable row level security;
alter table requests enable row level security;
alter table quote_items enable row level security;
alter table proofs enable row level security;
alter table payments enable row level security;
alter table payouts enable row level security;
alter table refunds enable row level security;
alter table disputes enable row level security;
alter table notifications enable row level security;
alter table transactions enable row level security; -- no policies => service-role only
alter table audit_log enable row level security;     -- no policies => service-role only

-- profiles
create policy "own profile read"  on profiles for select using (id = auth.uid() or auth_role() = 'admin');
create policy "own profile update" on profiles for update using (id = auth.uid());

-- buddy_profiles
create policy "buddy reads own" on buddy_profiles for select using (id = auth.uid() or auth_role() = 'admin');
create policy "buddy upserts own" on buddy_profiles for insert with check (id = auth.uid());
create policy "buddy updates own" on buddy_profiles for update using (id = auth.uid());

-- config: anyone reads active; admin writes
create policy "read active services" on service_types for select using (active or auth_role() = 'admin');
create policy "admin writes services" on service_types for all using (auth_role() = 'admin') with check (auth_role() = 'admin');
create policy "read active regions" on regions for select using (active or auth_role() = 'admin');
create policy "admin writes regions" on regions for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- requests: client own / buddy assigned / admin all (reads). Inserts by client only.
create policy "client reads own requests" on requests for select using (client_id = auth.uid());
create policy "buddy reads assigned requests" on requests for select using (assigned_buddy_id = auth.uid());
create policy "admin reads all requests" on requests for select using (auth_role() = 'admin');
create policy "client creates own request" on requests for insert with check (client_id = auth.uid() and auth_role() = 'client');
-- NOTE: status/price/assignment UPDATEs go through service-role server actions, not direct writes.

-- quote_items: visible if you can see the parent request
create policy "read quote items" on quote_items for select using (
  exists (select 1 from requests r where r.id = request_id
          and (r.client_id = auth.uid() or r.assigned_buddy_id = auth.uid() or auth_role() = 'admin'))
);

-- proofs: assigned buddy + owning client + admin read; assigned buddy inserts
create policy "read proofs" on proofs for select using (
  exists (select 1 from requests r where r.id = request_id
          and (r.client_id = auth.uid() or r.assigned_buddy_id = auth.uid() or auth_role() = 'admin'))
);
create policy "buddy uploads proof" on proofs for insert with check (
  buddy_id = auth.uid()
  and exists (select 1 from requests r where r.id = request_id and r.assigned_buddy_id = auth.uid())
);

-- payments / payouts / refunds: read-only for the relevant party; writes are service-role only
create policy "client reads own payments" on payments for select using (client_id = auth.uid() or auth_role() = 'admin');
create policy "buddy reads own payouts" on payouts for select using (buddy_id = auth.uid() or auth_role() = 'admin');
create policy "read refunds" on refunds for select using (
  auth_role() = 'admin' or exists (select 1 from payments p where p.id = payment_id and p.client_id = auth.uid())
);

-- disputes: raiser + admin
create policy "read disputes" on disputes for select using (raised_by = auth.uid() or auth_role() = 'admin');
create policy "client raises dispute" on disputes for insert with check (raised_by = auth.uid());

-- notifications: own only
create policy "read own notifications" on notifications for select using (user_id = auth.uid());
create policy "update own notifications" on notifications for update using (user_id = auth.uid());
