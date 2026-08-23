# Hardening & Go-Live Checklist

## Done in code (this build)
- Session-refresh middleware (`src/middleware.ts`) — no stale auth tokens
- Security headers (X-Frame-Options DENY, nosniff, HSTS, referrer & permissions policy)
- Rate limiting on sign-in/sign-up — **shared across instances** via a Postgres
  counter (`bump_rate_limit`, migration 0037), with the in-memory Map kept as a
  fast path. Fails open if the DB is unreachable, so an outage can't lock people out.
- Minimum password length (8), input length caps on request intake
- Branded 404 + error pages
- Private proof storage with path-scoped upload policy + 1-hour signed URLs
- All money/status writes: server-side only, state-machine-checked, timeline + audit logged
- Idempotency on payments/payouts/refunds via unique provider references
- Money-critical notification emails are **non-disableable** — `notifyTyped`
  ignores the on/off switch for `essential` types, and saving settings forces
  them back on, so a stale toggle can't silence a payment/payout/quote email
- Every email send outcome is recorded (`audit_log.action = 'email_send'`) —
  essential sends always, plus every failure of any kind
- Append-only ledger; transactions & audit_log readable by service role only

## Manual RLS pen-test (do once — 10 minutes)
1. Client A copies a request URL; Client B pastes it → must 404.
2. Buddy visits /client/dashboard and /admin/dashboard → must redirect to login.
3. Buddy's My Tasks must show ONLY their assigned tasks; payout visible, client price NEVER.
4. In browser devtools as a client, try fetching another user's data via supabase-js
   (e.g. `supabase.from('payouts').select('*')`) → must return only own rows / empty.
5. Unauthenticated: visit any portal URL → login redirect.

## Money reconciliation (run in Supabase SQL editor monthly / before payouts)
```sql
-- A) Ledger should equal money-in minus money-out
select
  (select coalesce(sum(amount_ngn),0) from transactions) as ledger_net,
  (select coalesce(sum(amount_ngn),0) from payments where status in ('succeeded','refunded')) 
  - (select coalesce(sum(amount_ngn),0) from payouts where status = 'paid')
  - (select coalesce(sum(amount_ngn),0) from refunds where status = 'succeeded') as computed_net;
-- B) No request paid twice
select request_id, count(*) from payments where status='succeeded' group by 1 having count(*)>1;
-- C) No payout exceeding its payment
select r.id from requests r
join payments p on p.request_id=r.id and p.status in ('succeeded','refunded')
join payouts o on o.request_id=r.id and o.status='paid'
where o.amount_ngn > p.amount_ngn;
-- D) Held funds must belong to active (non-terminal) requests
select p.request_id, r.status from payments p join requests r on r.id=p.request_id
where p.funds_held and r.status in ('refunded','paid_out','cancelled');
```
All four should return clean (A: equal numbers; B–D: zero rows).

## Before real users (go-live switches)
- [ ] Supabase → Auth → Email → turn **Confirm email ON**
- [ ] Set a strong `CRON_SECRET` in Vercel env (auto-release cron)
- [ ] `npm audit` — review; apply `npm audit fix` (never `--force` blindly)
- [ ] Rotate the service_role key if it was ever pasted anywhere outside `.env.local`
- [ ] Supabase → Database → Backups: confirm daily backups on (paid plan) or schedule manual exports
- [ ] Point WordPress CTAs at the app (`/signup`, `/apply`)
- [ ] **SPF + DKIM + DMARC on backhomebuddy.ng** — see EMAIL-DNS.md. Until this
      is done a share of all outbound mail is filtered or dropped silently,
      regardless of the app sending it correctly. Business-critical.
- [ ] Online payments: lawyer sign-off + Paystack/Flutterwave business account with Transfers enabled

## Verifying email delivery

When someone says they never received an email, don't guess — check:

```sql
select created_at, detail from audit_log
where action = 'email_send'
order by created_at desc limit 50;
```

`sent: true` → we handed it to Resend, so the problem is downstream (SPF/DKIM/
DMARC, spam filing, wrong address) — see **EMAIL-DNS.md**.
`sent: false` → it never left the app, and `reason` says why.

## Deferred consciously
- Email notifications (Resend/SMTP key) — wiring point exists in notify()
- Webhook signature verification — written into the payment step's route stubs
