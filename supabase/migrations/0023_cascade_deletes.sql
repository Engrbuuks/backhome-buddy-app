-- 0023: make deletes clean. Re-point child foreign keys to CASCADE (or SET NULL
-- for audit/history) so deleting a request or a user removes/detaches all
-- dependent rows without FK violations. Admin delete actions rely on this.

-- Helper to drop-and-recreate a FK with a chosen on-delete behaviour.
-- (Postgres has no ALTER CONSTRAINT for on-delete, so drop+add.)

-- ── Request children → CASCADE (deleting a request removes them) ──
do $$
begin
  -- payments
  if exists (select 1 from information_schema.table_constraints where constraint_name='payments_request_id_fkey') then
    alter table payments drop constraint payments_request_id_fkey;
  end if;
  alter table payments add constraint payments_request_id_fkey
    foreign key (request_id) references requests(id) on delete cascade;

  -- payouts
  if exists (select 1 from information_schema.table_constraints where constraint_name='payouts_request_id_fkey') then
    alter table payouts drop constraint payouts_request_id_fkey;
  end if;
  alter table payouts add constraint payouts_request_id_fkey
    foreign key (request_id) references requests(id) on delete cascade;

  -- refunds
  if exists (select 1 from information_schema.table_constraints where constraint_name='refunds_request_id_fkey') then
    alter table refunds drop constraint refunds_request_id_fkey;
  end if;
  alter table refunds add constraint refunds_request_id_fkey
    foreign key (request_id) references requests(id) on delete cascade;

  -- disputes
  if exists (select 1 from information_schema.table_constraints where constraint_name='disputes_request_id_fkey') then
    alter table disputes drop constraint disputes_request_id_fkey;
  end if;
  alter table disputes add constraint disputes_request_id_fkey
    foreign key (request_id) references requests(id) on delete cascade;

  -- transactions (request/payment/payout/refund) → SET NULL to preserve ledger history
  if exists (select 1 from information_schema.table_constraints where constraint_name='transactions_request_id_fkey') then
    alter table transactions drop constraint transactions_request_id_fkey;
  end if;
  alter table transactions add constraint transactions_request_id_fkey
    foreign key (request_id) references requests(id) on delete set null;
end $$;

-- Best-effort cascade for other request-scoped tables that may exist.
do $$
declare t text;
begin
  foreach t in array array['request_messages','request_timeline','quote_items','extra_charges','expectations','recipients']
  loop
    if exists (select 1 from information_schema.tables where table_name = t)
       and exists (select 1 from information_schema.columns where table_name = t and column_name = 'request_id') then
      execute format('alter table %I drop constraint if exists %I_request_id_fkey', t, t);
      execute format('alter table %I add constraint %I_request_id_fkey foreign key (request_id) references requests(id) on delete cascade', t, t);
    end if;
  end loop;
end $$;
