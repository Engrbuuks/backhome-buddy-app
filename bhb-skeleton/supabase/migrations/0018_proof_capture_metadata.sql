-- 0018: verifiable proof capture metadata.
-- captured_lat/lng/accuracy come from the device at the moment of capture;
-- captured_at is set by the buddy's device; server_received_at is set by the
-- server on insert (unfakeable). capture_method distinguishes in-app live
-- capture ('live') from a gallery upload ('upload') so trust level is visible.

alter table proofs
  add column if not exists captured_lat double precision,
  add column if not exists captured_lng double precision,
  add column if not exists captured_accuracy double precision,
  add column if not exists captured_at timestamptz,
  add column if not exists server_received_at timestamptz not null default now(),
  add column if not exists capture_method text not null default 'upload';
