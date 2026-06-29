# Backhome Buddy — App Architecture & Scoping

**Status:** v1 scoping. Source of truth for the application build.
**Last updated:** June 2026

---

## 0. How to read this document

This is the engineering plan for the Backhome Buddy application (the portals + payments),
separate from the marketing WordPress site. It is written to be understood first, then built.

Sections in order: scope → core loop → roles → data model → security → payments →
WP handoff → repo structure → build sequence → the no-code/code line → open decisions.

If you read nothing else, read **§1 (scope)**, **§6 (payments)**, and **§11 (open decisions)** —
those are where the money and the risk live.

---

## 1. Scope

### v1 — what we build first
The smallest system that runs the business end to end:

> client requests → admin quotes → client pays → admin assigns a buddy →
> buddy executes → buddy uploads proof → admin reviews → client confirms →
> buddy is paid out → done.

Plus the non-negotiable supporting pieces without which the loop is not operable or safe:
- Authentication + role-based access (client, buddy, admin)
- Buddy application + vetting
- Buddy payout (bank) details capture
- The money-state machine (held / released / refunded / failed)
- Cancellations + refunds + failed-payout handling
- Notifications (email at minimum; in-app list)
- Admin no-code config: service types, pricing, regions
- Transactions ledger (every naira in and out)

### v2 — explicitly deferred (do NOT build now)
Ratings/reviews · in-app chat/messaging · recurring/scheduled tasks ·
a full project-management module · buddy self-scheduling/availability calendar ·
analytics/BI dashboards · multi-currency · referral/loyalty · mobile native apps.

Deferring these is a decision, not an oversight. Each bolts onto the v1 data model cleanly
if the loop above is built correctly.

---

## 2. Core loop — the lifecycle of a request

Every request moves through an explicit status. The status is the spine of the whole app;
UI pills, permissions, and money states all hang off it.

```
DRAFT          client is still composing (optional; can submit directly)
SUBMITTED      client submitted; waiting for admin to quote
QUOTED         admin sent a price; waiting for client to pay
AWAITING_PAY   client clicked pay; payment in flight
PAID           payment succeeded; funds HELD; waiting for assignment
ASSIGNED       admin assigned a buddy; buddy not yet started
IN_PROGRESS    buddy started work
PROOF_READY    buddy uploaded proof; waiting for admin review
PROOF_APPROVED admin approved proof; waiting for client confirmation
COMPLETED      client confirmed; funds eligible for payout
PAID_OUT       buddy payout released
CANCELLED      cancelled (before or after payment; see refund rules)
REFUNDED       client refunded (full or partial)
DISPUTED       client raised an issue; admin resolving
```

Allowed transitions (anything not listed is forbidden and the API rejects it):

- DRAFT → SUBMITTED → QUOTED → AWAITING_PAY → PAID → ASSIGNED → IN_PROGRESS → PROOF_READY → PROOF_APPROVED → COMPLETED → PAID_OUT
- SUBMITTED/QUOTED → CANCELLED (no money moved; clean cancel)
- PAID/ASSIGNED → CANCELLED → REFUNDED (money was held; refund path)
- IN_PROGRESS/PROOF_READY/PROOF_APPROVED/COMPLETED → DISPUTED → (REFUNDED | PAID_OUT | partial)

**Rule that must never break:** a buddy payout can only happen from COMPLETED
(client-confirmed) or via an explicit admin DISPUTED resolution. Funds are never
payable while still HELD and unconfirmed.

---

## 3. Roles & trust model

| Role   | Trust    | Can see | Cannot see |
|--------|----------|---------|------------|
| Client | low      | only their own requests, quotes, payments, proof | anything about other clients, buddies, buddy payouts, admin tools |
| Buddy  | vetted   | only tasks assigned to them, their own earnings/payouts, their profile | other buddies' tasks/earnings, client contact beyond what a task needs, pricing margin, admin tools |
| Admin  | full     | everything | — |

- Clients self-register.
- Buddies apply and are **vetted by an admin** before they can be assigned work.
- Admins are **invite-only** (no public admin signup, ever).
- The buddy must never see the client's price — only their own payout. (Margin is private.)

---

## 4. Data model (plain language first)

Core entities and how they relate:

- **profiles** — one per auth user; holds role + shared profile fields. Extends Supabase `auth.users`.
- **buddy_profiles** — extra fields for buddies (coverage areas, skills, vetting status, bank/payout details).
- **service_types** — admin-editable catalogue (name, description, base price, default buddy payout %). *No-code config.*
- **regions** — admin-editable covered cities/states. *No-code config.*
- **requests** — the heart of the system; one per client errand. Holds status, service type, description, location, recipient details, client price, buddy payout amount, assigned buddy.
- **quote_items** — line items belonging to a request's quote.
- **proofs** — proof artifacts (photo/video/report) uploaded by a buddy for a request.
- **payments** — money IN: a client payment attempt against a request (provider, status, reference).
- **payouts** — money OUT: a payout to a buddy for a completed request (status, reference).
- **refunds** — money BACK: full/partial refund against a payment.
- **transactions** — append-only ledger; every payment/payout/refund writes a row. The financial source of truth.
- **notifications** — in-app notifications per user.
- **disputes** — raised against a request; holds evidence + resolution.
- **audit_log** — append-only record of sensitive admin actions (who released a payout, who approved a refund).

Relationship sketch:

```
auth.users 1─1 profiles 1─0..1 buddy_profiles
profiles(client) 1─* requests *─1 service_types
requests *─1 regions
requests 1─* quote_items
requests 1─* proofs (uploaded by assigned buddy)
requests 1─* payments 1─* refunds
requests 1─0..1 payouts (to assigned buddy)
requests 1─0..1 disputes
payments/payouts/refunds ──> transactions (ledger rows)
profiles 1─* notifications
```

---

## 5. Data model (SQL — Supabase/Postgres)

> Run in Supabase SQL editor. Enums first, then tables, then RLS (§5b). Reviewed before committing.

```sql
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

-- ===== PROFILES (extends auth.users) =====
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  full_name text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table buddy_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  vetting buddy_vetting not null default 'applied',
  coverage_region_ids uuid[] default '{}',
  skills text[] default '{}',
  id_document_url text,
  -- payout/bank details (capture before first payout)
  bank_name text, bank_account_number text, bank_account_name text,
  created_at timestamptz not null default now()
);

-- ===== NO-CODE CONFIG =====
create table service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  base_price_ngn numeric(12,2) not null default 0,
  default_buddy_payout_pct numeric(5,2) not null default 60,  -- % of client price
  active boolean not null default true,
  sort_order int default 0
);

create table regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,           -- e.g. "Lagos", "Ibadan"
  state text,
  active boolean not null default true
);

-- ===== REQUESTS =====
create table requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id),
  service_type_id uuid references service_types(id),
  region_id uuid references regions(id),
  status request_status not null default 'submitted',
  title text,
  description text,
  urgency text,                          -- 'standard' | 'urgent'
  recipient_name text, recipient_phone text, recipient_address text,
  client_price_ngn numeric(12,2),        -- total client pays (set at quote)
  buddy_payout_ngn numeric(12,2),        -- what buddy earns (private to admin/buddy)
  assigned_buddy_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  label text not null,
  amount_ngn numeric(12,2) not null
);

create table proofs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  buddy_id uuid not null references profiles(id),
  kind proof_kind not null,
  file_url text,           -- for photo/video (Supabase Storage)
  note text,               -- for report kind, or caption
  created_at timestamptz not null default now()
);

-- ===== MONEY =====
create table payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id),
  client_id uuid not null references profiles(id),
  provider payment_provider not null,
  provider_reference text unique,    -- the provider's txn ref / idempotency anchor
  amount_ngn numeric(12,2) not null,
  status payment_status not null default 'pending',
  funds_held boolean not null default false,  -- true after success, false after release/refund
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
  amount_ngn numeric(12,2) not null,
  reason text,
  provider_reference text unique,
  status payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- append-only ledger: never UPDATE/DELETE rows here
create table transactions (
  id uuid primary key default gen_random_uuid(),
  kind txn_kind not null,
  request_id uuid references requests(id),
  payment_id uuid references payments(id),
  payout_id uuid references payouts(id),
  refund_id uuid references refunds(id),
  amount_ngn numeric(12,2) not null,     -- positive = money in, negative = money out
  note text,
  created_at timestamptz not null default now()
);

-- ===== SUPPORT =====
create table disputes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id),
  raised_by uuid not null references profiles(id),
  reason text not null,
  resolution text,                 -- filled by admin
  resolved_outcome text,           -- 'refund' | 'release' | 'partial' | 'reassign'
  status text not null default 'open',  -- 'open' | 'resolved'
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,            -- e.g. 'release_payout','approve_refund','vet_buddy'
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
```

### 5b. Row-Level Security (the part that keeps you out of trouble)

RLS is enabled on every table. Principle: **deny by default, grant narrowly.**
A helper to read the caller's role:

```sql
create or replace function auth_role() returns user_role
language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

-- enable RLS everywhere
alter table profiles        enable row level security;
alter table buddy_profiles  enable row level security;
alter table requests        enable row level security;
alter table quote_items     enable row level security;
alter table proofs          enable row level security;
alter table payments        enable row level security;
alter table payouts         enable row level security;
alter table refunds         enable row level security;
alter table disputes        enable row level security;
alter table notifications   enable row level security;
alter table service_types   enable row level security;
alter table regions         enable row level security;
-- transactions & audit_log: NO client/buddy access at all (service-role only)
alter table transactions    enable row level security;
alter table audit_log       enable row level security;
```

Representative policies (full set generated during build):

```sql
-- profiles: a user sees/edits only their own row; admins see all
create policy "own profile read"  on profiles for select using (id = auth.uid() or auth_role() = 'admin');
create policy "own profile write" on profiles for update using (id = auth.uid());

-- requests: client sees own; assigned buddy sees assigned; admin sees all
create policy "client reads own requests" on requests for select
  using (client_id = auth.uid());
create policy "buddy reads assigned requests" on requests for select
  using (assigned_buddy_id = auth.uid());
create policy "admin reads all requests" on requests for select
  using (auth_role() = 'admin');
create policy "client creates own request" on requests for insert
  with check (client_id = auth.uid() and auth_role() = 'client');
-- NOTE: status/price/assignment changes happen via service-role server actions,
-- NOT direct client/buddy updates. Clients cannot UPDATE requests directly.

-- service_types / regions: everyone can read active config; only admin writes
create policy "anyone reads active services" on service_types for select using (active or auth_role() = 'admin');
create policy "admin writes services"        on service_types for all    using (auth_role() = 'admin');

-- payouts: buddy reads only their own; admin all; NO insert/update by buddy
create policy "buddy reads own payouts" on payouts for select using (buddy_id = auth.uid());
create policy "admin reads payouts"     on payouts for select using (auth_role() = 'admin');

-- transactions/audit_log: no policies for normal users => only service role can touch them
```

**Critical design choice:** money-moving and status-changing writes do NOT go through
client/buddy RLS-permitted updates. They go through **server-side actions running with the
service role**, which enforce the state machine in code. RLS protects *reads* and *simple
self-writes*; the *money logic* is enforced server-side. This is the single most important
safety decision in the build.

---

## 6. Payments — the collect-and-release model

### Decision (architected, pending legal confirmation)
We use **collect-and-release**, not true regulated escrow:
1. Client pays → money lands in Backhome Buddy's settlement account (via Paystack or Flutterwave).
2. Funds are marked **HELD** in our system (a flag + ledger state — not a separate bank account).
3. On client confirmation (or admin dispute resolution), funds are **RELEASED**: a payout
   (transfer) is sent to the buddy's bank account, and our margin remains.
4. If cancelled/disputed in the client's favour, a **REFUND** is issued instead.

> ⚠️ Legal note: holding client funds before release has regulatory weight in Nigeria.
> Paystack/Flutterwave standard products are payment collection + transfers, NOT escrow.
> The payout step is abstracted so a licensed escrow partner can be swapped in later.
> **Get a Nigerian fintech lawyer's sign-off before going live with real money.**

### The payment abstraction
One internal interface; the two providers implement it. Business logic never imports a
provider SDK directly.

```
PaymentProvider (interface)
  initializePayment(request, amount) -> { checkoutUrl | clientToken, reference }
  verifyPayment(reference)           -> { status, amount }
  initiatePayout(buddyBank, amount)  -> { reference, status }
  verifyPayout(reference)            -> { status }
  initiateRefund(payment, amount)    -> { reference, status }
  parseWebhook(payload, signature)   -> normalized event  (verifies signature!)

PaystackProvider implements PaymentProvider
FlutterwaveProvider implements PaymentProvider
```

### Webhooks (where payment systems actually break)
- Every provider webhook hits one endpoint per provider (`/api/webhooks/paystack`, `/flutterwave`).
- **Verify the signature first** (HMAC) — reject anything unsigned/forged. Non-negotiable.
- **Idempotency:** key on `provider_reference`. A webhook may arrive twice — processing it
  twice must not pay a buddy twice. Check-then-act inside a transaction.
- The webhook updates `payments`/`payouts` status and advances the request state machine.
  Never trust the browser redirect alone for "payment succeeded" — the webhook is truth.
- Always also expose a `verifyPayment` server check (belt and suspenders).

### Money-state invariants (enforced server-side, tested)
- A payout row can only be created/sent when its request is COMPLETED or via DISPUTED resolution.
- `funds_held = true` only after a succeeded payment; flips to false on release or refund.
- Total payouts + refunds for a request can never exceed the captured payment.
- Every payment/payout/refund writes exactly one `transactions` row (the ledger reconciles).

---

## 7. WordPress ↔ App contract (deliberately minimal)

The marketing site stays a pure brochure. The only link:
- "Submit a Request" / "Schedule a Free Call" buttons on the WP site **link to the app**
  (e.g. `app.backhomebuddy.ng/request/new`), optionally with a `?service=` query param to
  preselect a service type.
- No data sync, no shared database, no WP REST writes into the app in v1.
- (Optional later) the app could read the WP REST API to show latest blog posts — read-only,
  one direction, non-critical.

This avoids the classic two-systems-fighting-over-truth failure. The app owns all user,
task, and money data.

---

## 8. Repo / folder structure (Next.js App Router)

```
bhb-app/
  app/
    (marketing-redirects)/         # optional: /request/new entry from WP
    (auth)/login, signup, apply, reset/
    (client)/dashboard, requests/[id], pay/[id], settings/
    (buddy)/dashboard, tasks/[id], earnings, settings/
    (admin)/dashboard, requests, assignment, proofs, payouts,
            refunds, disputes, buddies, services, regions, ledger, users/
    api/
      webhooks/paystack/route.ts
      webhooks/flutterwave/route.ts
    layout.tsx
  lib/
    supabase/            # browser + server clients
    payments/            # PaymentProvider interface + paystack/ + flutterwave/
    auth/                # role guards, session helpers
    money/               # state machine, ledger writes, invariants
    notifications/       # email + in-app dispatch
  components/            # shared UI (reconcile generated screens here)
  server/                # service-role server actions (the money/status logic)
  types/                 # shared TS types (mirror the DB)
  supabase/
    migrations/          # SQL from §5
  .env.local             # secrets (never commit)
```

Stack: Next.js (App Router) + TypeScript · Supabase (Postgres, Auth, Storage) ·
Tailwind (matches marketing site tokens) · Vercel hosting · Paystack + Flutterwave.

---

## 9. Build sequence (each step independently testable)

1. **Project skeleton** — Next.js + TS + Tailwind (port the brand tokens), Supabase project, env wiring.
2. **Schema + RLS** — run §5/§5b migrations; verify policies with test users in Supabase.
3. **Auth + roles** — signup/login/reset, role guards, the three portal shells with nav. (No business logic yet.)
4. **No-code config** — admin CRUD for service_types + regions. (Proves the admin pattern end to end.)
5. **Request intake** — client creates a request; admin sees it in the queue. (Read/write + RLS proven.)
6. **Quoting** — admin builds a quote; client sees price. (No money yet — just the numbers.)
7. **Payments IN** — integrate one provider (Paystack first), checkout + webhook + verify + funds HELD.
   Test with provider test keys until bulletproof. Then add Flutterwave behind the same interface.
8. **Assignment + execution + proof** — admin assigns buddy; buddy uploads proof; admin reviews.
9. **Confirmation + payout** — client confirms; admin releases payout; money OUT + ledger.
10. **Edge money** — cancellations, refunds, failed payouts, disputes resolution.
11. **Notifications** — email triggers + in-app center.
12. **Hardening** — audit log, idempotency tests, RLS pen-test, money-invariant tests, error/empty states.
13. **WP link** — point marketing CTAs at the app.

Rule: do not start a step until the previous one is tested. Payments (step 7) is the
highest-risk step — slow down there.

---

## 10. The no-code / code line (your operating principle)

**No-code (operator does it in the Admin UI, no developer needed):**
service types, pricing, payout %, regions, quoting, assignment, proof approval, payout
release, refunds, dispute resolution, buddy vetting, notification templates, viewing the
ledger. Plus Supabase's own dashboard as a data-fix safety net.

**Code (developer territory — plumbing, security, money):**
auth + RLS, the request state machine, the payment abstraction, webhook handling +
signature verification + idempotency, payout/refund logic, money invariants, WP↔app link.

Rule of thumb: *business decisions = no-code; plumbing, security, and money = code.*

---

## 11. Open decisions (resolve before/while building)

1. **Legal: collect-and-release vs true escrow.** Architecture assumes collect-and-release,
   payout step swappable. Needs a Nigerian fintech lawyer's sign-off before live money. **(highest priority)**
2. **Provider priority + payout support.** Confirm both Paystack and Flutterwave Transfers
   are enabled on the business account (payouts to buddies require the Transfers/Disbursement product).
3. **Margin model.** Is buddy payout a flat % of client price (default 60%), per-service, or
   set manually per quote? The schema supports all three; pick the default behaviour.
4. **Refund policy.** Cancel-before-assignment = auto full refund? Cancel-after = admin
   decision? Define the rules so the UI can state them to clients.
5. **KYC depth for buddies.** What documents/verification are required to approve a buddy? Affects the application form.
6. **Currency.** Client pays in NGN only for v1? (Diaspora clients may expect to pay in USD/GBP —
   that's multi-currency, a v2 decision with real payment implications.)
7. **Who is the legal entity** holding funds during the held window, and what does that
   require operationally (settlement account, reconciliation cadence)?

---

*End of v1 architecture. Build from §9. Revisit §11 with a lawyer before real money flows.*
