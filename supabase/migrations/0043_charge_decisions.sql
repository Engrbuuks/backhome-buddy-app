-- 0043: a client may push back on an extra cost, but may never set it.
-- Run AFTER 0042. Idempotent: safe to run twice.
--
-- THE HOLE THIS CLOSES
--
-- 0011 gave clients a direct UPDATE policy on additional_charges:
--
--   using (status = 'proposed' and <the request is mine>)
--   with check (status in ('approved','declined'))
--
-- The `with check` constrains the status column and NOTHING ELSE. Every other
-- column, amount_ngn included, was free. A client holding the anon key their
-- own browser already uses could approve a 120,000 naira charge and rewrite it
-- to 100 in the same request, and the database would accept it. The admin
-- queue would then show an approved charge for 100 naira with no trace of the
-- original figure.
--
-- The server action was never the problem: decideCharge only ever writes
-- status and decided_at. The problem was that the action was not the only
-- writer. So the direct write right goes away entirely and every decision now
-- goes through the guarded action, where the amount is read from the row and
-- never from the caller.

drop policy if exists "client decides own additional charges" on additional_charges;

-- Clients keep their read policy from 0011, so they still see what was
-- proposed and why. Writes are service role only, as everywhere else that
-- money is involved.

-- Pushing back needs somewhere to say why. A declined charge with no reason
-- tells an admin a number was refused but nothing about what to propose
-- instead, which is how a task stalls.
alter table additional_charges
  add column if not exists decline_reason text;

comment on column additional_charges.decline_reason is
  'Why the client pushed back on this amount. Set only through decideCharge; '
  'clients have no direct write access to this table.';
