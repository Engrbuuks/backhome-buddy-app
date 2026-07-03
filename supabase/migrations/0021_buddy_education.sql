-- 0021: buddy education details.
alter table buddy_profiles
  add column if not exists education_level text,
  add column if not exists course_of_study text,
  add column if not exists year_of_graduation int,
  add column if not exists school_attended text;
