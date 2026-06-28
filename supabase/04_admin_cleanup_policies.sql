-- Run this file if your project was created before the Admin cleanup feature.
-- It allows the web app to delete selected records and remove Storage files via Supabase API.

drop policy if exists "authenticated delete edit logs" on public.edit_logs;
create policy "authenticated delete edit logs"
on public.edit_logs for delete
to authenticated
using (true);

drop policy if exists "authenticated delete area photos" on storage.objects;
create policy "authenticated delete area photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'area-photos');
