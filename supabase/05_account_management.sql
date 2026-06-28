-- Run this file to enable account management from the web app.
-- It adds a backup password note and safe profile update policies.

alter table public.profiles
add column if not exists password_note text;

update public.profiles
set password_note = coalesce(password_note, '')
where password_note is null;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
      and is_active = true
  );
$$;

grant execute on function public.current_user_is_admin() to authenticated;

drop policy if exists "admin read all profiles" on public.profiles;
create policy "admin read all profiles"
on public.profiles for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "admin update all profiles" on public.profiles;
create policy "admin update all profiles"
on public.profiles for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());
