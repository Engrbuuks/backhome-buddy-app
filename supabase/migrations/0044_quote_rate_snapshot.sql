-- 0044: freeze the exchange rate a client was quoted at. Run AFTER 0043.
-- Idempotent: safe to run twice.
--
-- THE LEAK THIS CLOSES
--
-- sendQuote already stored `fx_rate`, and that column was read in exactly one
-- cosmetic place. The figure the client is actually told to transfer was
-- rendered from the LIVE rate on every page load.
--
-- So: a task is quoted at 900,000 naira when the pound is 1900, and the client
-- is shown 473 pounds. An admin updates the rate to 2100 the next morning. The
-- same client reloads and is now told to pay 428 pounds. They pay it. The
-- payment is recorded as 900,000 naira received. The business is 85,000 naira
-- short and the books say paid in full.
--
-- The old column was worse than unused: it only ever held the USD rate, even
-- for a client paying in pounds, so it could not have fixed this on its own.
-- This stores the WHOLE rate map as it stood when the quote was sent.

alter table requests
  add column if not exists fx_rates_snapshot jsonb;

comment on column requests.fx_rates_snapshot is
  'Every display currency rate as it stood when the quote was sent. Once set, '
  'this is what the client is charged at, whatever the live rates do. Null on '
  'requests quoted before this migration, which fall back to live rates.';
