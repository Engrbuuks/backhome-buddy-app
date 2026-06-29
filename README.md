# Backhome Buddy — App

Next.js (App Router) + TypeScript + Tailwind + Supabase. The client/buddy/admin
portals and payments. Separate from the marketing WordPress site.

See **ARCHITECTURE.md** for the full system design and **build sequence (§9)**.
This repo is **step 1–3** of that sequence: skeleton + schema + auth scaffolding.

## What's here

```
src/
  app/
    page.tsx                     landing → links to /login, /signup, /apply
    (auth)/login|signup|apply    auth screens (Pack 1 UI plugs in here)
    (client)/client/dashboard    client portal (role-guarded)  → Pack 2
    (buddy)/buddy/dashboard      buddy portal  (role-guarded)  → Pack 4
    (admin)/admin/dashboard      admin portal  (role-guarded)  → Pack 3/5
    api/webhooks/paystack        payment webhook (wired at step 7)
    api/webhooks/flutterwave
  lib/
    supabase/{client,server,admin}.ts   browser / session / service-role clients
    auth/roles.ts                       getCurrentProfile + requireRole guard
    money/stateMachine.ts               request lifecycle transitions + payout rule
    payments/provider.ts                the PaymentProvider interface
  types/db.ts                           TS types mirroring the schema
supabase/migrations/0001_init.sql       full schema + RLS (run this in Supabase)
```

## Setup (the parts that are yours)

1. **Install:** `npm install`
2. **Create a Supabase project** at supabase.com. From Settings → API copy:
   - Project URL, anon public key, service_role key.
3. **Env:** copy `.env.local.example` → `.env.local` and fill the Supabase values.
   (Leave the payment keys empty until the payments step.)
4. **Run the schema:** open Supabase → SQL Editor → paste the contents of
   `supabase/migrations/0001_init.sql` → Run. (Or use the Supabase CLI: `supabase db push`.)
5. **Make yourself an admin:** after you sign up once, in Supabase Table Editor open
   `profiles`, find your row, set `role = admin`. (Admins are never self-serve.)
6. **Dev:** `npm run dev` → http://localhost:3000

## Build status
- `npm run build` compiles clean; all routes resolve. (Fonts use `next/font` —
  they fetch from Google at build, which needs network access.)

## Next steps (from ARCHITECTURE.md §9)
- Wire Pack 1 auth UI into `(auth)/*` and connect to Supabase auth.
- Build admin no-code config (service_types, regions) — step 4.
- Request intake → quoting → **payments (pause for legal sign-off)** → assignment →
  proof → confirmation → payout → edge money → notifications → hardening.

## Safety notes baked in
- `lib/supabase/admin.ts` (service role) bypasses RLS — use ONLY in trusted server
  code that enforces rules itself (money/status). Never import into client code.
- `lib/money/stateMachine.ts` defines legal status transitions + the payout-eligibility
  rule. Money/status changes must go through server actions that check these.
- Webhooks must verify signatures + be idempotent (see route file comments).
