-- 0005: private storage bucket for proof photos/videos (run AFTER 0004)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 26214400, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do nothing;

-- Buddies may upload ONLY into the folder of a request assigned to them: path = {request_id}/{file}
create policy "buddy uploads proof files" on storage.objects for insert
with check (
  bucket_id = 'proofs'
  and exists (
    select 1 from public.requests r
    where r.id::text = (storage.foldername(name))[1]
      and r.assigned_buddy_id = auth.uid()
  )
);
-- No select policy: files are served via short-lived signed URLs created server-side.
