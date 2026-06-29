-- 0009: buddy vetting — application details, documents, guarantors, admin checklist
-- Run AFTER 0008. Safe to re-run (IF NOT EXISTS / ON CONFLICT guards).

-- ===== Stage 1: collected on the public /apply form =====
alter table buddy_profiles add column if not exists city text;
alter table buddy_profiles add column if not exists date_of_birth date;
alter table buddy_profiles add column if not exists nin text;
alter table buddy_profiles add column if not exists address text;
alter table buddy_profiles add column if not exists state text;
alter table buddy_profiles add column if not exists lga text;
alter table buddy_profiles add column if not exists coverage_areas text;
alter table buddy_profiles add column if not exists occupation text;
alter table buddy_profiles add column if not exists experience text;
alter table buddy_profiles add column if not exists availability text;
alter table buddy_profiles add column if not exists has_smartphone boolean default false;
alter table buddy_profiles add column if not exists can_drive boolean default false;
alter table buddy_profiles add column if not exists has_drivers_license boolean default false;
alter table buddy_profiles add column if not exists criminal_record boolean;
alter table buddy_profiles add column if not exists criminal_record_details text;
alter table buddy_profiles add column if not exists consent_background_checks boolean default false;
alter table buddy_profiles add column if not exists consent_data_processing boolean default false;

-- ===== Stage 2: completed in the buddy portal after shortlisting =====
-- guarantors: jsonb array of up to 2 objects
--   { name, occupation, phone, address, relationship }
alter table buddy_profiles add column if not exists guarantors jsonb default '[]'::jsonb;
-- next_of_kin: { name, relationship, phone }
alter table buddy_profiles add column if not exists next_of_kin jsonb default '{}'::jsonb;
-- Private storage paths (vetting bucket), served via short-lived signed URLs
alter table buddy_profiles add column if not exists id_doc_type text;      -- nin_slip | voters_card | drivers_license | passport
alter table buddy_profiles add column if not exists id_doc_path text;
alter table buddy_profiles add column if not exists utility_bill_path text;
alter table buddy_profiles add column if not exists pcc_path text;          -- Police Character Certificate

-- ===== Admin vetting checklist =====
-- vetting_checks keys (all must be true before approval):
--   id_verified, nin_checked, address_verified, guarantor1_verified,
--   guarantor2_verified, pcc_received, interview_done, training_done
alter table buddy_profiles add column if not exists vetting_checks jsonb default '{}'::jsonb;
alter table buddy_profiles add column if not exists vetting_notes text;

-- ===== Private bucket for vetting documents =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vetting', 'vetting', false, 10485760,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- A buddy may upload ONLY into their own folder: path = {auth.uid()}/{file}
create policy "buddy uploads own vetting docs" on storage.objects for insert
with check (
  bucket_id = 'vetting'
  and (storage.foldername(name))[1] = auth.uid()::text
);
-- Allow replacing their own files (re-upload of a clearer scan)
create policy "buddy updates own vetting docs" on storage.objects for update
using (
  bucket_id = 'vetting'
  and (storage.foldername(name))[1] = auth.uid()::text
);
-- No select policy: admins view via short-lived signed URLs created server-side.
