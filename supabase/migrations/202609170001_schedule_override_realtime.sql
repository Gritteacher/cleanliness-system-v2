-- Notify every live view when an admin marks or restores a holiday.
create or replace function private.cs_touch_schedule_override_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  v_date := case when tg_op = 'DELETE' then old.duty_date else new.duty_date end;

  insert into public.cs_live_updates (duty_date, changed_at, change_id)
  values (v_date, now(), gen_random_uuid())
  on conflict (duty_date) do update
    set changed_at = excluded.changed_at,
        change_id = excluded.change_id;

  if tg_op = 'UPDATE' and old.duty_date is distinct from new.duty_date then
    insert into public.cs_live_updates (duty_date, changed_at, change_id)
    values (old.duty_date, now(), gen_random_uuid())
    on conflict (duty_date) do update
      set changed_at = excluded.changed_at,
          change_id = excluded.change_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists cs_overrides_live_update on public.cs_schedule_overrides;
create trigger cs_overrides_live_update
after insert or update or delete on public.cs_schedule_overrides
for each row execute function private.cs_touch_schedule_override_update();

alter table public.cs_schedule_overrides replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cs_schedule_overrides'
  ) then
    alter publication supabase_realtime add table public.cs_schedule_overrides;
  end if;
end;
$$;

revoke all on function private.cs_touch_schedule_override_update() from public, anon, authenticated;
