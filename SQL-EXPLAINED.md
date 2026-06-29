# Backhome Buddy — The Database Schema, Explained

A plain-language walkthrough of the Supabase/Postgres SQL in ARCHITECTURE.md (§5).
Written to be read later, on its own. If you understand this file, you understand the
data foundation of the whole app.

---

## The mental model first

Postgres (which Supabase runs) is a relational database:
- You define **tables** — like spreadsheets with strongly-typed columns.
- Rows reference each other with **foreign keys** — a column in one table pointing at a
  row's `id` in another.
- Supabase adds **Auth** (a built-in `auth.users` table it manages for you) and **RLS**
  (Row-Level Security — rules deciding which rows each logged-in user may touch).

RLS is the part most people get wrong, so it gets the most attention below.

---

## 1. Enums — locking down the vocabulary

```sql
create type request_status as enum (
  'draft','submitted','quoted','awaiting_pay','paid','assigned',
  'in_progress','proof_ready','proof_approved','completed','paid_out',
  'cancelled','refunded','disputed'
);
```

An `enum` is a custom type that can hold ONLY one of a fixed list of values. If `status`
were free `text`, a typo like `"complete"` vs `"completed"` would silently create bugs.
As an enum, the database itself rejects anything not in the list.

Why it matters: request status is the spine of the app — UI pills, permissions, and money
rules all branch on it. An enum makes an invalid status *impossible to store*, not just
discouraged. Same technique for `payment_status`, `payout_status`, `user_role`, etc.
Each enum is a small contract the database enforces for you.

---

## 2. profiles — extending the user

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  full_name text,
  ...
);
```

Supabase manages `auth.users` (emails, passwords, sessions) — you don't touch it directly.
To attach your OWN fields to a user (like their role), you make a `profiles` table where:

- `id ... references auth.users(id)` — the profile's id IS the auth user's id. One-to-one.
  A profile can't exist without a matching auth user.
- `on delete cascade` — delete the auth user and the profile auto-deletes. No orphan rows.
- `role user_role not null default 'client'` — everyone is a client unless set otherwise;
  `not null` means it can never be empty.

**Why `uuid` not 1,2,3?** UUIDs (random ids like `a3f2...`) match Supabase auth and don't
leak information — an attacker can't guess that "user 47" exists or count your users by
watching ids climb.

The pattern "extend `auth.users` with a `profiles` table" is THE standard Supabase idiom.
Learn it once; use it on every project.

---

## 3. buddy_profiles — role-specific data

```sql
create table buddy_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  vetting buddy_vetting not null default 'applied',
  coverage_region_ids uuid[] default '{}',
  skills text[] default '{}',
  bank_account_number text,
  ...
);
```

Clients need a basic profile; buddies need more (vetting, coverage areas, bank details).
Rather than piling buddy-only fields into `profiles` (where they'd be null for every
client), we split them into their own table keyed to the same id.

- `id ... references profiles(id)` — one-to-one, but optional (only exists for buddies).
- `uuid[]` / `text[]` — the `[]` makes them **arrays**: a buddy covers multiple regions and
  has multiple skills, stored as a list in one column. `default '{}'` = empty array.
- Bank details live here (not in generic `profiles`) deliberately — sensitive, buddy-only,
  and locked down hard by RLS later.

---

## 4. service_types & regions — the NO-CODE config

```sql
create table service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_price_ngn numeric(12,2) not null default 0,
  default_buddy_payout_pct numeric(5,2) not null default 60,
  active boolean not null default true,
  sort_order int default 0
);
```

This is the table that makes "add a service / change a price" a **no-code** action — the
admin edits these rows in the UI, no developer needed.

- `default gen_random_uuid()` — these rows generate their own random id on insert (unlike
  profiles, whose id comes from auth).
- `numeric(12,2)` — the **money type**: up to 12 digits, 2 after the decimal.
  **NEVER store money as `float`.** Floats can't represent `0.10` exactly → rounding errors
  → real disputes. `numeric` is exact. (Senior-dev rule: money is always numeric/decimal.)
- `active boolean` — discontinue a service by flagging it inactive, NOT deleting it
  (deleting would break historical requests that referenced it). Soft state, not hard delete.
- `sort_order int` — admin controls display order.

---

## 5. requests — the heart of the system

```sql
create table requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id),
  service_type_id uuid references service_types(id),
  status request_status not null default 'submitted',
  client_price_ngn numeric(12,2),
  buddy_payout_ngn numeric(12,2),
  assigned_buddy_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Every column is a deliberate relationship:

- `client_id not null references profiles(id)` — every request belongs to exactly one
  client; `not null` = never ownerless.
- `service_type_id references service_types(id)` — nullable (no `not null`), because a
  "custom request" might not map to a predefined service.
- `client_price_ngn` and `buddy_payout_ngn` are **separate columns** — the privacy design:
  store the client's price and the buddy's cut independently so the buddy is shown only
  their payout, never your margin.
- `assigned_buddy_id references profiles(id)` — nullable; no buddy until admin assigns one.
  Points back to `profiles` (same table as `client_id`) because clients and buddies are
  both profiles, just different roles.
- `timestamptz` = "timestamp WITH time zone" — always use this variant so you never guess
  Lagos vs UTC. `default now()` stamps automatically.

**What's deliberately NOT here:** any logic forcing status to move legally
(submitted→quoted→paid…). The database stores the status; the *rules for changing it* live
in server-side code. Money/status transitions are too important for loose database writes.

---

## 6. quote_items — one-to-many

```sql
create table quote_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  label text not null,
  amount_ngn numeric(12,2) not null
);
```

A quote has multiple line items ("Property visit: ₦15,000", "Transport: ₦5,000"). Each line
is its own row pointing back to its request via `request_id`. Classic **one-to-many**: one
request, many quote_items. `on delete cascade` = delete the request and its line items go
with it (no orphans).

---

## 7. The money tables — payments, payouts, refunds

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id),
  provider payment_provider not null,
  provider_reference text unique,
  amount_ngn numeric(12,2) not null,
  status payment_status not null default 'pending',
  funds_held boolean not null default false,
  ...
);
```

Three separate tables: money IN (`payments`), OUT (`payouts`), BACK (`refunds`). The key
columns:

- `provider payment_provider` — Paystack or Flutterwave (enum).
- `provider_reference text unique` — the id the provider returns. **`unique` is doing heavy
  lifting:** the database physically refuses two rows with the same reference. That's your
  **idempotency anchor** — if a webhook fires twice (they do), the duplicate insert fails
  the unique constraint instead of recording a second payment. THIS is how you stop paying a
  buddy twice from a doubled webhook.
- `status payment_status` — pending → succeeded/failed/refunded.
- `funds_held boolean` — true once payment succeeds (money in your account, waiting), flips
  false on release to buddy or refund. This single flag tracks the "held" state of the
  collect-and-release model.

---

## 8. transactions — the append-only ledger

```sql
create table transactions (
  id uuid primary key default gen_random_uuid(),
  kind txn_kind not null,
  amount_ngn numeric(12,2) not null,   -- positive = money in, negative = money out
  ...
);
```

The financial source of truth. Every payment, payout, and refund writes ONE row here.
Positive = money in, negative = money out.

**Append-only:** you only ever ADD rows here — never UPDATE or DELETE. A ledger you can edit
is a ledger you can't trust. If reconciliation ever disagrees, you need an immutable record
of what actually happened. The other tables can change as status updates; `transactions` is
the permanent record. (This is how accountants/auditors think — and how your money tables
should too.)

---

## 9. RLS — Row-Level Security (the part that keeps you safe)

Turn on RLS and **by default nobody can read or write any row** until you write a policy
allowing it. Deny-by-default.

```sql
alter table requests enable row level security;
```

After that line, a logged-in user sees ZERO rows in `requests` until a policy grants access.
Safe by default — you can't accidentally leak data you forgot to protect.

**The helper:**
```sql
create or replace function auth_role() returns user_role
language sql stable as $$
  select role from profiles where id = auth.uid()
$$;
```
`auth.uid()` = the id of the currently logged-in user making the request. So `auth_role()`
returns that user's role. Now policies can ask "what role is the caller?"

**The policies:**
```sql
create policy "client reads own requests" on requests for select
  using (client_id = auth.uid());
```
Read literally: "for SELECT on requests, allow a row ONLY if its `client_id` equals the
logged-in user's id." A client automatically sees only their own requests — even if app code
accidentally asks for ALL requests, the database silently filters. Security at the data
layer, not trusted to the app.

```sql
create policy "buddy reads assigned requests" on requests for select
  using (assigned_buddy_id = auth.uid());
create policy "admin reads all requests" on requests for select
  using (auth_role() = 'admin');
```
Multiple policies on the same table/action are **OR'd**: a row is visible if ANY policy
allows it. Client sees their own OR buddy sees assigned OR admin sees all — each role gets
exactly its slice of the same table.

```sql
create policy "client creates own request" on requests for insert
  with check (client_id = auth.uid() and auth_role() = 'client');
```
- `using` filters which EXISTING rows you can see/act on.
- `with check` validates NEW rows you try to insert.
This says: you can only create a request where you set yourself as the client, and only if
you're a client. No forging requests on someone else's behalf.

**The most important note in the whole schema:**
```
status/price/assignment changes happen via service-role SERVER actions,
NOT direct client/buddy updates. Clients cannot UPDATE requests directly.
```
There's no policy letting clients/buddies UPDATE requests. Intentional. Changing status to
"paid" or setting a payout runs through **server-side code using the service role** (a
special key that bypasses RLS) which enforces the state-machine rules. RLS guards reads and
simple self-writes; money logic is guarded by code. The two layers together are the safety
model.

```
transactions / audit_log: enable RLS, write NO policies => only the service role can touch
them. No client, buddy, or even admin-through-the-UI can read/write the ledger directly.
The financial record is sealed off entirely.
```

---

## The three ideas worth internalizing

1. **Constrain at the database, not just the app.** Enums, `not null`, `unique`,
   `numeric` for money — these make whole categories of bugs *impossible to store* rather
   than relying on app code to be careful. The database is your last line of defense and it
   never gets tired.

2. **RLS is deny-by-default and enforced below the app.** You grant narrow access per role
   with `using` / `with check`. Even buggy app code can't leak rows a policy forbids. The
   *data* checks permissions, not just the app.

3. **Money gets special treatment.** Exact `numeric` types, `unique` references for
   idempotency, an append-only ledger, and money-state changes routed through server code
   instead of open database writes. The money design assumes things WILL go wrong (doubled
   webhooks, retries, failures) and stays correct anyway.

---

## Quick glossary

- **uuid** — a long random unique id; safer than sequential integers.
- **foreign key** (`references`) — a column pointing at another table's row.
- **on delete cascade** — when the parent row is deleted, delete the children too.
- **not null** — the column must always have a value.
- **unique** — no two rows can share this value (used for idempotency on payment refs).
- **numeric(12,2)** — exact decimal money type; never use float for money.
- **timestamptz** — timestamp with time zone; always prefer over plain timestamp.
- **enum** — a column restricted to a fixed set of allowed values.
- **array (`type[]`)** — a column holding a list of values.
- **RLS** — Row-Level Security; per-row access rules enforced by the database.
- **policy** — a single RLS rule (`using` for reads/existing rows, `with check` for inserts).
- **auth.uid()** — Supabase function returning the current logged-in user's id.
- **service role** — a privileged key that bypasses RLS; used only by trusted server code.
- **idempotency** — the property that doing an operation twice has the same effect as once
  (so a doubled webhook can't pay twice).
- **append-only** — a table you only insert into, never update/delete (the ledger).
