-- Privileged test runner only. Every synthetic write is rolled back.
begin;
select set_config('test.admin',(select id::text from public.cs_profiles where role='admin' and active limit 1),true);
select set_config('test.president',(select id::text from public.cs_profiles where role='president' and active limit 1),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$
declare v public.cs_practice_reports; old_version timestamptz; denied boolean=false; p jsonb='{"duty_date":"2026-11-09","team_id":"maen","teacher_names":["ทดสอบสิทธิ์ ไม่บันทึกจริง"],"outcome":"normal","details":"ข้อมูลทดสอบใน transaction rollback","action_taken":"","photos":[{"full":"https://nefjjpfbhljknbxeqrfd.supabase.co/storage/v1/object/public/practice-duty-photos/security-test.full.jpg","thumbnail":"https://nefjjpfbhljknbxeqrfd.supabase.co/storage/v1/object/public/practice-duty-photos/security-test.thumb.jpg"}]}'::jsonb;
begin
  v=public.cs_admin_manage_practice_report('create','e0632981-47b6-4814-bcaa-35912d0658b4',p,null);
  if v.status<>'published' or v.teacher_name<>'ทดสอบสิทธิ์ ไม่บันทึกจริง' then raise exception 'Admin create failed';end if;
  old_version=v.updated_at;
  p=jsonb_set(p,'{duty_date}','"2026-11-08"'::jsonb);
  v=public.cs_admin_manage_practice_report('update',v.id,p,v.updated_at);
  if v.start_time<>time '08:00' or v.end_time<>time '16:00' or v.updated_at=old_version then raise exception 'Admin edit/schedule failed';end if;
  begin perform public.cs_admin_manage_practice_report('update',v.id,p,old_version);exception when serialization_failure then denied=true;end;
  if not denied then raise exception 'Stale overwrite was permitted';end if;
  v=public.cs_admin_manage_practice_report('delete',v.id,'{}',v.updated_at);
  if v.deleted_at is null then raise exception 'Soft delete failed';end if;
  perform set_config('test.version',v.updated_at::text,true);
end;
$$;
set local role anon;
do $$begin if exists(select 1 from public.cs_practice_reports where id='e0632981-47b6-4814-bcaa-35912d0658b4') then raise exception 'Deleted data leaked publicly';end if;end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.president'),true);
do $$declare denied boolean=false;affected integer;begin
  begin perform public.cs_admin_manage_practice_report('restore','e0632981-47b6-4814-bcaa-35912d0658b4','{}',current_setting('test.version')::timestamptz);exception when insufficient_privilege then denied=true;end;
  if not denied then raise exception 'Non-admin RPC was permitted';end if;
  update public.cs_practice_reports set details='forbidden' where id='e0632981-47b6-4814-bcaa-35912d0658b4';get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Non-admin direct update was permitted';end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$declare v public.cs_practice_reports;begin
  v=public.cs_admin_manage_practice_report('restore','e0632981-47b6-4814-bcaa-35912d0658b4','{}',current_setting('test.version')::timestamptz);
  if v.deleted_at is not null then raise exception 'Restore failed';end if;
end;$$;
set local role anon;
do $$begin if not exists(select 1 from public.cs_practice_reports where id='e0632981-47b6-4814-bcaa-35912d0658b4') then raise exception 'Restored report not public';end if;end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.president'),true);
do $$declare affected integer;denied boolean=false;begin
  update public.cs_practice_reports set details='forbidden' where id='e0632981-47b6-4814-bcaa-35912d0658b4';get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Non-admin modified a visible report';end if;
  begin delete from public.cs_practice_reports where id='e0632981-47b6-4814-bcaa-35912d0658b4';exception when insufficient_privilege then denied=true;end;
  if not denied then raise exception 'Hard delete was permitted';end if;
end;$$;
rollback;
select 'PASS: admin create/edit/delete/restore, schedule, concurrency, public visibility and non-admin denial; all test writes rolled back' as result;
