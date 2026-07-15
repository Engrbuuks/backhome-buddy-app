-- 0028: make coverage_areas a real text[] array for clean multi-LGA storage.
-- Was 'text'. Convert existing values: split on ; or , into array elements.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name='buddy_profiles' and column_name='coverage_areas' and data_type <> 'ARRAY'
  ) then
    alter table buddy_profiles
      alter column coverage_areas type text[]
      using (
        case
          when coverage_areas is null or btrim(coverage_areas) = '' then null
          else (
            select array_agg(btrim(x)) from unnest(string_to_array(replace(coverage_areas, ';', ','), ',')) as x
            where btrim(x) <> ''
          )
        end
      );
  end if;
end $$;
