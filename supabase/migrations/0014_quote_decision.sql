-- 0014: client response to quotes (run AFTER 0013)
alter table requests add column if not exists quote_decision text
  check (quote_decision in ('accepted','changes_requested') or quote_decision is null);
alter table requests add column if not exists quote_decision_note text;
