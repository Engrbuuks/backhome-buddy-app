-- 0017: buddy NDA e-signature record.
-- A buddy signs the NDA in-app (typed full name + agree, timestamped). The
-- signature is required before approval (enforced in app + surfaced in checklist).

alter table buddy_profiles
  add column if not exists nda_signed_at timestamptz,
  add column if not exists nda_signed_name text,
  add column if not exists nda_version text;
