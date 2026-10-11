# Backhome Buddy — deploying

## Project layout

The application builds from `./src`. There is exactly one copy of it.

> **Never create a `bhb-skeleton/` folder in this repo.**
> A second copy of the app used to live there. Because `tsconfig.json` maps
> `@/*` to `./src/*` but includes `**/*.tsx`, the duplicate was type-checked
> while every import still resolved to the root tree. Work copied into it
> compiled against the root tree's older modules, which produced build errors
> that looked impossible ("has no exported member X" for a file that plainly
> had X). The folder is now gitignored and excluded from type-checking so it
> cannot happen again.

## Local setup

```bash
npm install
npm run typecheck   # run this before every push: it catches most build failures in seconds
npm run dev
```

## Database

Migrations live in `supabase/migrations/` and are run in filename order in the
Supabase SQL editor. All are idempotent and safe to re-run.

Outstanding as of build 119:

| Migration | What it adds |
|---|---|
| `0038_trust_tiers_and_identity.sql` | Trust tiers, buddy clearance, optional identity checks, completed-task counter |
| `0039_task_offers.sql` | The offer and accept layer, with the atomic accept function |
| `0040_push_and_offer_mode.sql` | Web push subscriptions, delivery records, the offer safety valve |

Note on numbering: `0037` is deliberately unused. It is reserved for a rate
limit migration that was written but never deployed.

## Environment

See `.env.local.example` for the full list. Two things worth calling out.

**Web push is optional.** Generate keys once with `npx web-push generate-vapid-keys`,
then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`. Leave them
unset and push quietly does nothing; everything else works unchanged.

**Email deliverability is DNS, not code.** See `EMAIL-DNS.md` if it is present,
or check `notification_deliveries` to see whether a message was accepted by the
provider before assuming the app failed to send it.

## Offer mode

Task offers default to **advisory**: the system picks the best buddy and
notifies them, but the admin still assigns. Nothing expires and nothing
cascades.

Only switch to `automatic` once `notification_deliveries` shows that offers are
reliably reaching buddies' phones. An automatic cascade is only as good as its
ability to reach someone; if alerts are not landing, offers expire unseen and
every task returns to the admin queue anyway.

```sql
update app_settings set value = '{"mode":"automatic"}'::jsonb where key = 'offer_mode';
```

## Scheduled jobs

Configured in `vercel.json`, both protected by `CRON_SECRET`.

- `/api/cron/auto-release` — daily, confirms completed work after the objection window
- `/api/cron/offers` — daily, expires stale offers and cascades to the next buddy

> **Why daily, when offer windows are 20 to 45 minutes?**
> Vercel's Hobby plan rejects any cron more frequent than once per day, and the
> whole deployment fails with "Hobby accounts are limited to daily cron jobs".
> So offer expiry does not rely on the cron: `maybeExpireOffers` runs the same
> sweep lazily whenever a buddy opens their dashboard or an admin opens a
> request, throttled to once a minute across the deployment. The daily cron is
> only a backstop for quiet periods when nobody loads anything.
>
> On a Pro plan you can set this back to `*/10 * * * *` for tighter timing. It
> is not required; the lazy sweep covers the realistic cases on its own.
