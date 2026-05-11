-- Private recordings bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings',
  'recordings',
  false,
  524288000, -- 500 MB
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/m4a', 'audio/x-m4a']
)
on conflict (id) do nothing;

-- Only the file owner or an admin can read/write their recordings
create policy "recordings_owner_select" on storage.objects
  for select using (
    bucket_id = 'recordings'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from profiles where user_id = auth.uid() and role = 'admin'
      )
    )
  );

create policy "recordings_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "recordings_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'recordings'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from profiles where user_id = auth.uid() and role = 'admin'
      )
    )
  );
