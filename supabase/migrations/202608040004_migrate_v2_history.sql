-- Migrate all V2 master data and history into V3 without deleting V2.
-- Idempotent: stable UUIDs and upserts make this safe to re-run.

begin;

alter table public.cs_submission_photos
  add column if not exists legacy_public_url text,
  add column if not exists legacy_thumbnail_url text,
  add column if not exists legacy_source_path text,
  add column if not exists legacy_thumbnail_path text;

alter table public.cs_published_room_results
  add column if not exists legacy_public_url text,
  add column if not exists legacy_thumbnail_url text;

create or replace function private.cs_legacy_uuid(p_kind text, p_value text)
returns uuid
language sql
immutable
strict
set search_path = ''
as $$
  select (
    substr(v.hash, 1, 8) || '-' ||
    substr(v.hash, 9, 4) || '-' ||
    substr(v.hash, 13, 4) || '-' ||
    substr(v.hash, 17, 4) || '-' ||
    substr(v.hash, 21, 12)
  )::uuid
  from (select md5(p_kind || ':' || p_value) as hash) v;
$$;

revoke all on function private.cs_legacy_uuid(text, text) from public, anon, authenticated;

-- One historical term contains every V2 record and remains active for the pilot.
insert into public.cs_school_terms (
  id, academic_year, semester, name, start_date, end_date, active, created_at, updated_at
)
values (
  private.cs_legacy_uuid('term', '2569-1'),
  2569,
  1,
  'ภาคเรียนที่ 1 ปีการศึกษา 2569',
  '2026-05-18',
  '2026-10-09',
  true,
  now(),
  now()
)
on conflict (academic_year, semester) do update set
  name = excluded.name,
  start_date = least(public.cs_school_terms.start_date, excluded.start_date),
  end_date = greatest(public.cs_school_terms.end_date, excluded.end_date),
  active = true,
  updated_at = now();

-- Areas preserve the V2 ID in legacy_id and receive stable V3 UUIDs.
insert into public.cs_areas (
  id, legacy_id, code, name, sort_order, active, created_at, updated_at
)
select
  private.cs_legacy_uuid('area', a.id),
  a.id,
  upper(replace(a.id, 'area-', 'A')),
  a.area_name,
  a.area_no,
  a.is_active,
  a.created_at,
  a.updated_at
from public.duty_areas a
on conflict (legacy_id) do update set
  code = excluded.code,
  name = excluded.name,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = excluded.updated_at;

-- Expand rooms_by_team JSON into one assignment per team/area.
insert into public.cs_team_area_assignments (
  id, term_id, team_id, area_id, room_label, sort_order, active, created_at, updated_at
)
select
  private.cs_legacy_uuid('assignment', a.id || ':' || room.team_id),
  t.id,
  room.team_id,
  ca.id,
  room.room_label,
  a.area_no,
  a.is_active,
  a.created_at,
  a.updated_at
from public.duty_areas a
cross join lateral jsonb_each_text(a.rooms_by_team) as room(team_id, room_label)
join public.cs_areas ca on ca.legacy_id = a.id
join public.cs_teams ct on ct.id = room.team_id
join public.cs_school_terms t on t.academic_year = 2569 and t.semester = 1
on conflict (term_id, team_id, area_id) do update set
  room_label = excluded.room_label,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = excluded.updated_at;

-- Convert the V2 weekday names into ISO weekday numbers.
insert into public.cs_duty_schedules (
  id, term_id, weekday, team_id, created_at, updated_at
)
select
  private.cs_legacy_uuid('schedule', '2569-1:' || team.id),
  t.id,
  case team.duty_day
    when 'monday' then 1
    when 'tuesday' then 2
    when 'wednesday' then 3
    when 'thursday' then 4
    when 'friday' then 5
  end,
  team.id,
  team.created_at,
  team.updated_at
from public.color_teams team
join public.cs_school_terms t on t.academic_year = 2569 and t.semester = 1
where team.duty_day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')
on conflict (term_id, weekday) do update set
  team_id = excluded.team_id,
  updated_at = excluded.updated_at;

-- Preserve source actors and timestamps instead of replacing them in V3 actor triggers.
alter table public.cs_duty_submissions disable trigger cs_submission_actor;
alter table public.cs_duty_submissions disable trigger cs_submissions_audit;
alter table public.cs_evaluations disable trigger cs_evaluation_actor;
alter table public.cs_evaluations disable trigger cs_evaluations_audit;
alter table public.cs_submission_photos disable trigger cs_photo_actor;
alter table public.cs_submission_photos disable trigger cs_photos_audit;

-- Import 357 duty records plus synthetic records for all score-only groups.
with source_records as (
  select
    d.id as legacy_id,
    d.record_date,
    d.area_id,
    d.room,
    d.duty_color_id,
    lower(d.status)::public.cs_duty_status as duty_status,
    case when d.status = 'PRESENT' then greatest(d.student_count, 0) else 0 end as student_count,
    nullif(d.photo_note, '') as note,
    coalesce(
      d.submitted_by,
      (select p.id from public.cs_profiles p where p.display_name = d.submitted_name limit 1),
      (select p.id from public.cs_profiles p where p.team_id = d.duty_color_id and p.role = 'president' limit 1),
      (select p.id from public.cs_profiles p where p.role = 'admin' limit 1)
    ) as actor_id,
    d.submitted_at,
    d.updated_at
  from public.duty_records d

  union all

  select
    'score-only-' || md5(c.record_date::text || ':' || c.area_id || ':' || c.duty_color_id),
    c.record_date,
    c.area_id,
    max(c.room),
    c.duty_color_id,
    'present'::public.cs_duty_status,
    0,
    'นำเข้าจากคะแนน V2 ที่ไม่มีรายการเวรต้นทาง',
    coalesce(
      (select p.id from public.cs_profiles p where p.team_id = c.duty_color_id and p.role = 'president' limit 1),
      (select p.id from public.cs_profiles p where p.role = 'admin' limit 1)
    ),
    min(c.submitted_at),
    max(c.updated_at)
  from public.clean_scores c
  left join public.duty_records d
    on d.record_date = c.record_date
    and d.area_id = c.area_id
    and d.duty_color_id = c.duty_color_id
  where d.id is null
  group by c.record_date, c.area_id, c.duty_color_id
)
insert into public.cs_duty_submissions (
  id, assignment_id, duty_date, duty_status, student_count, note,
  workflow_status, submitted_by, updated_by, submitted_at,
  locked_at, deleted_at, created_at, updated_at
)
select
  private.cs_legacy_uuid('submission', s.legacy_id),
  assignment.id,
  s.record_date,
  s.duty_status,
  s.student_count,
  s.note,
  'submitted'::public.cs_workflow_status,
  s.actor_id,
  s.actor_id,
  s.submitted_at,
  null,
  null,
  s.submitted_at,
  s.updated_at
from source_records s
join public.cs_areas area on area.legacy_id = s.area_id
join public.cs_school_terms term on term.academic_year = 2569 and term.semester = 1
join public.cs_team_area_assignments assignment
  on assignment.term_id = term.id
  and assignment.team_id = s.duty_color_id
  and assignment.area_id = area.id
where s.actor_id is not null
on conflict (id) do update set
  assignment_id = excluded.assignment_id,
  duty_date = excluded.duty_date,
  duty_status = excluded.duty_status,
  student_count = excluded.student_count,
  note = excluded.note,
  submitted_by = excluded.submitted_by,
  updated_by = excluded.updated_by,
  submitted_at = excluded.submitted_at,
  updated_at = excluded.updated_at,
  deleted_at = null;

-- Import all 2,177 evaluator scores, including the 405 orphan scores now attached to synthetic submissions.
insert into public.cs_evaluations (
  id, submission_id, evaluator_team_id, score, reason,
  evaluated_by, updated_by, evaluated_at, deleted_at, created_at, updated_at
)
select
  private.cs_legacy_uuid('evaluation', c.id),
  submission.id,
  c.evaluator_color_id,
  c.clean_score,
  nullif(c.score_note, ''),
  coalesce(
    c.submitted_by,
    (select p.id from public.cs_profiles p where p.display_name = c.submitted_name limit 1),
    (select p.id from public.cs_profiles p where p.team_id = c.evaluator_color_id and p.role = 'president' limit 1),
    (select p.id from public.cs_profiles p where p.role = 'admin' limit 1)
  ),
  coalesce(
    c.submitted_by,
    (select p.id from public.cs_profiles p where p.display_name = c.submitted_name limit 1),
    (select p.id from public.cs_profiles p where p.team_id = c.evaluator_color_id and p.role = 'president' limit 1),
    (select p.id from public.cs_profiles p where p.role = 'admin' limit 1)
  ),
  c.submitted_at,
  null,
  c.submitted_at,
  c.updated_at
from public.clean_scores c
join public.cs_areas area on area.legacy_id = c.area_id
join public.cs_school_terms term on term.academic_year = 2569 and term.semester = 1
join public.cs_team_area_assignments assignment
  on assignment.term_id = term.id
  and assignment.team_id = c.duty_color_id
  and assignment.area_id = area.id
join public.cs_duty_submissions submission
  on submission.assignment_id = assignment.id
  and submission.duty_date = c.record_date
  and submission.deleted_at is null
on conflict (id) do update set
  submission_id = excluded.submission_id,
  evaluator_team_id = excluded.evaluator_team_id,
  score = excluded.score,
  reason = excluded.reason,
  evaluated_by = excluded.evaluated_by,
  updated_by = excluded.updated_by,
  evaluated_at = excluded.evaluated_at,
  updated_at = excluded.updated_at,
  deleted_at = null;

-- Keep every legacy photo URL usable immediately. Physical files remain untouched in area-photos.
insert into public.cs_submission_photos (
  id, submission_id, storage_path, thumbnail_path, sort_order,
  uploaded_by, is_public, deleted_at, created_at, updated_at,
  legacy_public_url, legacy_thumbnail_url, legacy_source_path, legacy_thumbnail_path
)
select
  private.cs_legacy_uuid('photo', d.id),
  submission.id,
  'legacy/' || d.id,
  null,
  0,
  coalesce(
    d.submitted_by,
    (select p.id from public.cs_profiles p where p.display_name = d.submitted_name limit 1),
    (select p.id from public.cs_profiles p where p.team_id = d.duty_color_id and p.role = 'president' limit 1),
    (select p.id from public.cs_profiles p where p.role = 'admin' limit 1)
  ),
  true,
  null,
  d.submitted_at,
  d.updated_at,
  nullif(d.photo_url, ''),
  nullif(d.photo_thumb_url, ''),
  nullif(d.photo_path, ''),
  nullif(d.photo_thumb_path, '')
from public.duty_records d
join public.cs_duty_submissions submission
  on submission.id = private.cs_legacy_uuid('submission', d.id)
where nullif(d.photo_url, '') is not null or nullif(d.photo_path, '') is not null
on conflict (id) do update set
  submission_id = excluded.submission_id,
  uploaded_by = excluded.uploaded_by,
  is_public = true,
  deleted_at = null,
  updated_at = excluded.updated_at,
  legacy_public_url = excluded.legacy_public_url,
  legacy_thumbnail_url = excluded.legacy_thumbnail_url,
  legacy_source_path = excluded.legacy_source_path,
  legacy_thumbnail_path = excluded.legacy_thumbnail_path;

alter table public.cs_duty_submissions enable trigger cs_submission_actor;
alter table public.cs_duty_submissions enable trigger cs_submissions_audit;
alter table public.cs_evaluations enable trigger cs_evaluation_actor;
alter table public.cs_evaluations enable trigger cs_evaluations_audit;
alter table public.cs_submission_photos enable trigger cs_photo_actor;
alter table public.cs_submission_photos enable trigger cs_photos_audit;

-- Preserve all V2 edit logs with stable IDs and best-effort actor mapping.
insert into public.cs_audit_logs (
  id, actor_id, action, entity_type, entity_id,
  old_data, new_data, reason, request_id, created_at
)
select
  private.cs_legacy_uuid('audit', log.id),
  (select p.id from public.cs_profiles p where p.display_name = log.edited_by or p.username = lower(log.edited_by) limit 1),
  log.action,
  'legacy_' || log.table_name,
  log.record_id,
  log.old_data,
  log.new_data,
  'นำเข้าจาก V2' || case when nullif(log.edited_by, '') is not null then ' · ผู้แก้ไขเดิม: ' || log.edited_by else '' end,
  private.cs_legacy_uuid('audit-request', log.id),
  log.edited_at
from public.edit_logs log
on conflict (id) do update set
  actor_id = excluded.actor_id,
  action = excluded.action,
  entity_type = excluded.entity_type,
  entity_id = excluded.entity_id,
  old_data = excluded.old_data,
  new_data = excluded.new_data,
  reason = excluded.reason,
  created_at = excluded.created_at;

-- Calculate public daily and room snapshots for all 26 historical score dates.
do $$
declare
  v_date date;
  v_admin_id uuid;
begin
  select id into v_admin_id
  from public.cs_profiles
  where role = 'admin' and active = true
  limit 1;

  if v_admin_id is null then
    raise exception 'Active V3 admin profile required for publishing migration';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);

  for v_date in
    select distinct duty_date
    from public.cs_duty_submissions
    where deleted_at is null
    order by duty_date
  loop
    perform public.cs_admin_publish_day(v_date);
  end loop;
end;
$$;

-- Link each published historical room snapshot to its original public photo URLs.
update public.cs_published_room_results result
set
  legacy_public_url = nullif(record.photo_url, ''),
  legacy_thumbnail_url = nullif(record.photo_thumb_url, ''),
  updated_at = now()
from public.duty_records record
join public.cs_areas area on area.legacy_id = record.area_id
where result.score_date = record.record_date
  and result.team_id = record.duty_color_id
  and result.area_id = area.id;

commit;
