-- Keep operational photos private and copy only published photos to a public snapshot bucket.

begin;

alter table public.cs_published_room_results
  add column if not exists photo_public_urls text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cs-published-photos',
  'cs-published-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists cs_published_storage_insert on storage.objects;
create policy cs_published_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'cs-published-photos' and (select private.cs_is_admin()));

drop policy if exists cs_published_storage_select on storage.objects;
create policy cs_published_storage_select on storage.objects
for select to authenticated
using (bucket_id = 'cs-published-photos' and (select private.cs_is_admin()));

drop policy if exists cs_published_storage_update on storage.objects;
create policy cs_published_storage_update on storage.objects
for update to authenticated
using (bucket_id = 'cs-published-photos' and (select private.cs_is_admin()))
with check (bucket_id = 'cs-published-photos' and (select private.cs_is_admin()));

drop policy if exists cs_published_storage_delete on storage.objects;
create policy cs_published_storage_delete on storage.objects
for delete to authenticated
using (bucket_id = 'cs-published-photos' and (select private.cs_is_admin()));

commit;
