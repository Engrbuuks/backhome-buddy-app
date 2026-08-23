-- 0022: ensure capture_method has a working default and no existing NULLs.
-- Corrects cases where the column ended up NOT NULL without an applied default.

-- Backfill any existing NULLs first (so the NOT NULL constraint is satisfiable).
update proofs set capture_method = 'upload' where capture_method is null;

-- Ensure the default is set going forward.
alter table proofs alter column capture_method set default 'upload';

-- Ensure server_received_at also has its default (same family of columns).
alter table proofs alter column server_received_at set default now();
update proofs set server_received_at = created_at where server_received_at is null;
