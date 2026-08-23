# Migrations

Run in filename order, top to bottom. Each file states which one it follows.

## Rules

- **One number, one file.** Never reuse a number. If two changes are authored
  around the same time, the later one takes the next free number.
- **Idempotent where possible** — `add column if not exists`, `create table if
  not exists`, `on conflict do nothing`. Re-running a migration should be a
  no-op, not a surprise.
- **Guard one-time backfills.** A plain `UPDATE ... WHERE <condition>` in a
  migration is *not* idempotent: re-running it re-applies the change on top of
  whatever the app has legitimately done since. Gate it behind a marker row (see
  `0016b` for the pattern).

## Note on 0016

There were briefly two files numbered `0016`
(`0016_visitor_identity.sql` and `0016_chat_human_takeover.sql`). They touch
different columns, so the order between them never mattered and nothing was
broken by it — but it made "run them in order" ambiguous.

The second has been renamed to **`0016b_chat_human_takeover.sql`** and its
backfill is now guarded. If you already ran the old file, do nothing: re-running
the new one is safe, and the guard means the backfill can never be applied twice.
