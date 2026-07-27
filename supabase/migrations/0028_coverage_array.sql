-- 0028: make coverage_areas a real text[] array for clean multi-LGA storage.
-- Was 'text'. Convert existing values without a subquery (Postgres forbids
-- subqueries inside an ALTER COLUMN ... USING transform).
--
-- Strategy: normalise the string with regexp_replace (unify ';' to ',', trim
-- whitespace around commas and at the ends), split with string_to_array, then
-- drop any empty elements with array_remove — all inline, no subquery.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'buddy_profiles'
      and column_name = 'coverage_areas'
      and data_type <> 'ARRAY'
  ) then
    alter table buddy_profiles
      alter column coverage_areas type text[]
      using (
        case
          when coverage_areas is null or btrim(coverage_areas) = '' then null
          else array_remove(
                 string_to_array(
                   btrim(                                   -- trim ends
                     regexp_replace(
                       regexp_replace(coverage_areas, ';', ',', 'g'),  -- ';' -> ','
                       '\s*,\s*', ',', 'g'                   -- trim spaces around commas
                     )
                   ),
                   ','
                 ),
                 ''                                          -- drop empty elements
               )
        end
      );
  end if;
end $$;
