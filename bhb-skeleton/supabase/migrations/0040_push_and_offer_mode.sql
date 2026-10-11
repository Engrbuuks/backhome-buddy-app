-- 0040: web push subscriptions, delivery records, and the offer safety valve.
-- Run AFTER 0039.
--
-- WHY
--
-- The offer layer gives a buddy 20 to 45 minutes to answer, but the only ways
-- it could reach them were an in-app notification (which requires them to be
-- looking at the site) and email (which can sit unread all afternoon). A time
-- boxed offer with no way to reach a phone is a design fault: offers would
-- expire unseen and every task would land back in the admin queue.
--
-- Web push fixes that for free. Once a buddy installs the site to their home
-- screen and allows notifications, their phone buzzes even with the app closed.
--
-- The safety valve exists because that only works for buddies who HAVE
-- installed it. Until enough of them have, the cascade should suggest rather
-- than decide.

-- ── 1. Push subscriptions ────────────────────────────────────────────────
--
-- One row per browser per device. A buddy with a phone and a laptop has two.
-- Subscriptions expire or are revoked without warning, so this table is
-- expected to accumulate dead rows; sending prunes them on a 404 or 410.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- The browser's endpoint URL. Unique: re-subscribing the same browser must
  -- update the existing row rather than pile up duplicates and send twice.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- Count of consecutive send failures. Used to retire a dead subscription
  -- without deleting one that merely had a bad night.
  failure_count int not null default 0
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- A user may see and remove their own subscriptions. Inserts go through the
-- server action so the row is always bound to the signed-in user.
do $$ begin
  create policy push_subs_own_select on push_subscriptions
    for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy push_subs_own_delete on push_subscriptions
    for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

comment on table push_subscriptions is
  'Web push endpoints, one per browser per device. Pruned automatically when a '
  'push is rejected as gone.';

-- ── 2. Delivery records ──────────────────────────────────────────────────
--
-- Without this you cannot tell a buddy who ignored an offer from one who never
-- received it, and those need completely different responses from you.

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  -- in_app | email | push | sms | whatsapp
  channel text not null,
  -- The concrete sender used, e.g. 'resend', 'web-push', or an SMS gateway.
  provider text,
  -- What this was about, so a stalled offer can be traced end to end.
  type_key text,
  request_id uuid references requests(id) on delete set null,
  -- Did the provider accept it? Delivery to the handset is never guaranteed.
  accepted boolean not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists notification_deliveries_user_idx
  on notification_deliveries (user_id, created_at desc);
create index if not exists notification_deliveries_request_idx
  on notification_deliveries (request_id, created_at desc);

alter table notification_deliveries enable row level security;

comment on table notification_deliveries is
  'Per channel send outcomes. accepted = the provider took it, NOT that it '
  'reached the handset.';

-- ── 3. The offer safety valve ────────────────────────────────────────────
--
--   off       — no offers at all; assignment is entirely manual (old behaviour)
--   advisory  — an offer is raised and the buddy is notified, but it never
--               expires and never cascades; the admin still presses Assign
--   automatic — the full cascade
--
-- Advisory is the default, deliberately. It collects accept rates, response
-- times and decline reasons from day one while manual assignment remains the
-- mechanism that actually moves work. Switch to automatic once the delivery
-- records show that offers are reaching people.

insert into app_settings (key, value)
values ('offer_mode', '{"mode": "advisory"}'::jsonb)
on conflict (key) do nothing;

-- How many expiries before a request stops cascading and goes to a human.
-- Two in a row is already the signal that the channel is not working; there is
-- no sense discovering that on the twelfth buddy.
insert into app_settings (key, value)
values ('offer_max_expiries', '{"count": 2}'::jsonb)
on conflict (key) do nothing;
