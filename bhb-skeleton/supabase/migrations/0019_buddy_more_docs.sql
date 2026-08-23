-- 0019: additional buddy documents.
-- passport_photo_path shows on the buddy's dashboard as their profile photo.
-- nin_slip_path is the uploaded NIN slip (the NIN number is already stored in nin).
-- cv_path is the uploaded CV/résumé.

alter table buddy_profiles
  add column if not exists passport_photo_path text,
  add column if not exists nin_slip_path text,
  add column if not exists cv_path text;
