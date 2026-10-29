-- Existing accounts/roles are not changed. Deleted reports remain recoverable.
alter table public.cs_practice_reports add column updated_at timestamptz not null default now();
alter table public.cs_practice_reports add column deleted_at timestamptz;
create index cs_practice_deleted_day on public.cs_practice_reports(duty_date,created_at desc) where deleted_at is not null;
create function private.cs_practice_touch() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at=clock_timestamp(); return new; end;
$$;
revoke all on function private.cs_practice_touch() from public,anon,authenticated;
create trigger cs_practice_touch before update on public.cs_practice_reports for each row execute function private.cs_practice_touch();

alter policy practice_reports_public_read on public.cs_practice_reports using (status='published' and deleted_at is null);
create policy practice_reports_admin_select on public.cs_practice_reports for select to authenticated using ((select private.cs_is_admin()));
create policy practice_reports_admin_insert on public.cs_practice_reports for insert to authenticated with check ((select private.cs_is_admin()));
create policy practice_reports_admin_update on public.cs_practice_reports for update to authenticated using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));
grant insert(id,duty_date,team_id,teacher_name,teacher_names,outcome,details,action_taken,start_time,end_time,confirmed,photos,status) on public.cs_practice_reports to authenticated;
grant update(duty_date,team_id,teacher_name,teacher_names,outcome,details,action_taken,start_time,end_time,confirmed,photos,status,deleted_at) on public.cs_practice_reports to authenticated;
-- No DELETE grant/policy: deletion is a reversible timestamp update only.

create function public.cs_admin_manage_practice_report(p_operation text,p_id uuid,p_report jsonb default '{}'::jsonb,p_expected_updated_at timestamptz default null)
returns public.cs_practice_reports language plpgsql security invoker set search_path='' as $$
declare v public.cs_practice_reports; v_date date; v_names text[]; v_start time; v_end time;
begin
  if (select auth.uid()) is null or not (select private.cs_is_admin()) then raise exception 'Admin permission required' using errcode='42501'; end if;
  if p_operation is null or p_operation not in ('create','update','delete','restore') or p_id is null then raise exception 'Invalid operation' using errcode='22023'; end if;
  if p_operation<>'create' then
    select * into v from public.cs_practice_reports where id=p_id and status='published' for update;
    if not found then raise exception 'Report not found' using errcode='P0002'; end if;
    if p_expected_updated_at is null or v.updated_at is distinct from p_expected_updated_at then raise exception 'Report changed; reload before saving' using errcode='40001'; end if;
    if p_operation='update' and v.deleted_at is not null then raise exception 'Restore report before editing' using errcode='22023'; end if;
  end if;
  if p_operation in ('delete','restore') then
    update public.cs_practice_reports set deleted_at=case when p_operation='delete' then clock_timestamp() else null end where id=p_id returning * into v;
    return v;
  end if;
  if jsonb_typeof(p_report->'teacher_names') is distinct from 'array' then raise exception 'Teacher names required' using errcode='22023'; end if;
  select array_agg(trim(name) order by position) into v_names from jsonb_array_elements_text(p_report->'teacher_names') with ordinality as t(name,position);
  v_date=(p_report->>'duty_date')::date;
  v_start=case when extract(isodow from v_date) in (6,7) then time '08:00' else null end;
  v_end=case when extract(isodow from v_date) in (6,7) then time '16:00' when v_date<=date '2026-11-15' then time '19:00' else time '20:00' end;
  if p_operation='create' then
    insert into public.cs_practice_reports(id,duty_date,team_id,teacher_name,teacher_names,outcome,details,action_taken,start_time,end_time,confirmed,photos,status)
    values(p_id,v_date,p_report->>'team_id',v_names[1],v_names,p_report->>'outcome',trim(p_report->>'details'),case when p_report->>'outcome'='incident' then trim(p_report->>'action_taken') else '' end,v_start,v_end,true,p_report->'photos','published') returning * into v;
  else
    update public.cs_practice_reports set duty_date=v_date,team_id=p_report->>'team_id',teacher_name=v_names[1],teacher_names=v_names,outcome=p_report->>'outcome',details=trim(p_report->>'details'),action_taken=case when p_report->>'outcome'='incident' then trim(p_report->>'action_taken') else '' end,start_time=v_start,end_time=v_end,photos=p_report->'photos' where id=p_id returning * into v;
  end if;
  return v;
end;
$$;
revoke all on function public.cs_admin_manage_practice_report(text,uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.cs_admin_manage_practice_report(text,uuid,jsonb,timestamptz) to authenticated;
