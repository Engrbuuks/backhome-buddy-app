-- 0045: a narrower service catalogue, prices that need no human, purpose bound
-- payment, and monthly retainers. Run AFTER 0044. Idempotent.
--
-- WHY THE CATALOGUE SHRINKS
--
-- Eight services, each individually quoted by one person, is the shape of an
-- agency pretending to be a marketplace. Two of the eight could not be won:
--
--   Package Delivery competed with GIG, Kwik and the courier networks, who are
--   cheaper and already give the client tracking. The whole premium here is
--   proof and recourse, and a courier already provides proof, so there was
--   nothing left to sell. It also meant handling goods that can be lost, and
--   medications bring a regulatory problem nobody wants.
--
--   Surprise Visits was bespoke every time, unpriceable, labour heavy and
--   emotionally unforgiving: nobody forgives a ruined birthday. It could not
--   be standardised and it could not recur.
--
-- Government Errands and Document Processing were one job wearing two names.
-- From the client's side both are "something is stuck inside a Nigerian
-- institution and I am not in the country". Two names split the volume of the
-- strongest vertical and divided its search traffic.
--
-- Nothing is deleted. Existing requests point at these rows, and deleting a
-- service type would orphan a client's history. They are deactivated, which
-- removes them from every dropdown while leaving the past intact.

-- ===== A price that needs no human =====
--
-- 'from' only ever DISPLAYED a starting figure; the request still travelled
-- submitted -> quoted -> awaiting_pay, so a person wrote a quote for every
-- one. 'fixed' means the published price is the price.
alter table service_types drop constraint if exists service_types_pricing_mode_check;
alter table service_types add constraint service_types_pricing_mode_check
  check (pricing_mode in ('from','quote','fixed'));

-- Services that collect a bill on the client's behalf need somewhere to say
-- what is being paid and to whom. handles_cash already exists from 0038 and
-- means the vendor is paid directly, so the buddy coordinates and documents
-- but never holds the money.
alter table service_types
  add column if not exists requires_payee boolean not null default false,
  -- What to call the third party on the form: "school", "hospital", "landlord".
  add column if not exists payee_label text;

-- ===== Purpose bound payment, on the request =====
alter table requests
  add column if not exists payee_name text,
  add column if not exists payee_detail text,
  -- The bill itself, in naira. Recorded as a PURCHASE line in quote_items so
  -- the accounting screen never counts money passing through to a school or a
  -- hospital as revenue this business earned.
  add column if not exists vendor_amount_ngn numeric(12,2),
  -- Set when the price was computed by code rather than typed by a person.
  add column if not exists priced_automatically boolean not null default false;

comment on column requests.vendor_amount_ngn is
  'The third party bill this task exists to settle. Passes through: it is a '
  'purchase, never service revenue.';

-- ===== THE CATALOGUE =====

-- Retire the two that cannot be won.
update service_types set active = false
 where active = true
   and (name ilike '%package%deliver%' or name ilike '%surprise%visit%');

-- Fold Government Errands into Document Processing.
update service_types set active = false
 where active = true and name ilike '%government%errand%';

-- Reposition the keepers. Names are matched loosely because the live rows were
-- edited by hand in the admin and may not read exactly as seeded.
update service_types
   set name = 'Documents & Government',
       description = 'Certificates, records, affidavits, transcripts, police reports, '
                     'authentication and legalisation. Applications submitted, progress '
                     'chased, documents collected and delivered securely. Includes agency '
                     'visits and anything stuck inside a Nigerian institution.'
 where name ilike '%document%' and active = true;

update service_types
   set name = 'Family Care',
       description = 'A visit to your parents or loved ones: welfare check, photographs and '
                     'video, a written report, and a call with you afterwards. Includes '
                     'hospital and clinic accompaniment — we take them to the appointment, '
                     'wait with them, tell you what the doctor said, and collect the '
                     'prescription. Available as a monthly retainer.'
 where name ilike '%family%welfare%' or (name ilike '%welfare%' and active = true);

update service_types
   set name = 'Property',
       description = 'Site inspection before you buy or send money: GPS verified photographs, '
                     'neighbourhood assessment, red flags named plainly. Also ongoing '
                     'oversight of a property you already own — tenant and caretaker checks, '
                     'rent follow up, periodic inspection — as a monthly retainer.'
 where name ilike '%property%' and active = true;

update service_types
   set name = 'Business Representation',
       description = 'Attend a meeting, inspect a site, verify a vendor, file a document, '
                     'represent your company on the ground in Nigeria. Priced per engagement '
                     'at business rates.'
 where name ilike '%corporate%' and active = true;

-- The new one. Inserted only if a service of this shape is not already there.
insert into service_types (name, description, pricing_mode, from_price_usd, handles_cash, requires_payee, payee_label, trust_tier, active, sort_order)
select
  'Pay It For Me',
  'Send the money for a purpose and see the purpose met. School fees paid at the bursary, '
  'a hospital bill settled at the counter, rent handed over with a signed acknowledgement, '
  'materials bought and counted on site. We pay the institution directly, photograph the '
  'receipt, and never hand cash to anybody.',
  'fixed', 25, true, true, 'Who should be paid (school, hospital, landlord, vendor)',
  'high_value', true, 15
where not exists (select 1 from service_types where name ilike 'pay it for me');

-- Custom Requests comes off the main list. Eight services with "anything else"
-- at the end reads as not knowing what you do. It stays available, last.
update service_types set sort_order = 99
 where name ilike '%custom%' and active = true;

-- ===== MONTHLY RETAINERS =====
--
-- The single biggest gap in the model: nothing recurred. Every task needed a
-- fresh decision to buy, a fresh quote, a fresh assignment and a fresh
-- payment, which is four acts of friction per unit of revenue, forever.
--
-- A retainer also fixes thin coverage, which is the real supply problem. A
-- buddy holding eight monthly retainers in Ibadan has a reason to stay
-- available and answer offers. One off tasks give them no reason to wait.
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  service_type_id uuid references service_types(id) on delete set null,
  region_id uuid references regions(id) on delete set null,

  -- What the generated task should say and who it concerns. Copied onto each
  -- month's request so a change here never rewrites a task already done.
  title text not null,
  description text,
  recipient_name text,
  recipient_phone text,
  recipient_address text,

  -- One price a month, in naira, agreed once. No quote per visit: that is the
  -- whole point.
  monthly_price_ngn numeric(12,2) not null,

  -- Which day of the month the task is raised. Clamped to 28 so February
  -- behaves and nobody's retainer silently skips a month.
  day_of_month int not null default 1,

  -- active | paused | cancelled
  status text not null default 'active',

  next_run_on date not null,
  last_run_on date,
  runs_count int not null default 0,

  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

do $$ begin
  alter table subscriptions add constraint subscriptions_status_known
    check (status in ('active','paused','cancelled'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table subscriptions add constraint subscriptions_day_sane
    check (day_of_month between 1 and 28);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table subscriptions add constraint subscriptions_price_positive
    check (monthly_price_ngn > 0);
exception when duplicate_object then null; end $$;

create index if not exists subscriptions_due_idx
  on subscriptions (next_run_on) where status = 'active';
create index if not exists subscriptions_client_idx
  on subscriptions (client_id, status);

-- Which subscription raised a task, so a client can see the series and an
-- admin can tell a retainer visit from a one off.
alter table requests
  add column if not exists subscription_id uuid references subscriptions(id) on delete set null;

create index if not exists requests_subscription_idx
  on requests (subscription_id) where subscription_id is not null;

alter table subscriptions enable row level security;

-- Belt and braces: the server actions use the service role, so these only
-- matter if a client key ever reaches this table directly.
do $$ begin
  create policy "client reads own subscriptions" on subscriptions
    for select using (client_id = auth.uid());
exception when duplicate_object then null; end $$;

-- A retainer is raised once per BILLING MONTH per subscription. Without this a
-- cron that runs twice, or an admin pressing the manual button beside it,
-- bills somebody twice.
--
-- The period is stored as its own 'YYYY-MM' column rather than derived from
-- created_at in the index. Two reasons. Postgres refuses created_at::date in
-- an index at all, because casting timestamptz to date depends on the session
-- time zone and so is not immutable. And the honest invariant is one task per
-- MONTH, not per day: a per day index would happily bill twice across a run at
-- 23:59 and another at 00:01.
alter table requests
  add column if not exists billing_period text;

comment on column requests.billing_period is
  'YYYY-MM of the retainer month this task bills for. Set only on tasks raised '
  'from a subscription, and the thing that makes double billing impossible.';

create unique index if not exists requests_one_per_subscription_period
  on requests (subscription_id, billing_period)
  where subscription_id is not null and billing_period is not null;

comment on table subscriptions is
  'Monthly retainers. Each raises one already priced request per month, which '
  'skips the quote entirely — that is the point of it.';
