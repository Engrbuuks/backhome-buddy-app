-- 0031: quote negotiation. A client can propose a counter-price; the admin can
-- re-quote or accept it. A round counter caps endless haggling.

-- Allow the new 'countered' decision alongside the existing ones.
alter table requests drop constraint if exists requests_quote_decision_check;
alter table requests add constraint requests_quote_decision_check
  check (quote_decision in ('accepted','changes_requested','countered') or quote_decision is null);

-- The client's proposed counter-amount (in NGN, the internal base) and how many
-- negotiation rounds have happened so far.
alter table requests add column if not exists counter_amount_ngn numeric(12,2);
alter table requests add column if not exists negotiation_rounds int not null default 0;
