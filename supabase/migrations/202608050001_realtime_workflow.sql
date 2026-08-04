-- Live workflow: no draft/submit/publish step, assignment-first evaluations,
-- public-safe realtime notifications, and admin account insights.

begin;

alter table public.cs_evaluations
  add column if not exists assignment_id uuid references public.cs_team_area_assignments(id) on delete restrict,
  add column if not exists duty_date date;

alter table public.cs_evaluations disable trigger cs_evaluation_actor;
alter table public.cs_evaluations disable trigger cs_evaluations_audit;

update public.cs_evaluations e
set assignment_id = s.assignment_id,
    duty_date = s.duty_date
from public.cs_duty_submissions s
where s.id = e.submission_id
  and (e.assignment_id is null or e.duty_date is null);

alter table public.cs_evaluations enable trigger cs_evaluation_actor;
alter table public.cs_evaluations enable trigger cs_evaluations_audit;

alter table public.cs_evaluations
  alter column assignment_id set not null,
  alter column duty_date set not null,
  alter column submission_id drop not null;

create unique index if not exists cs_evaluations_active_assignment_date_team_idx
on public.cs_evaluations (assignment_id, duty_date, evaluator_team_id)
where deleted_at is null;

create index if not exists cs_evaluations_date_assignment_idx
on public.cs_evaluations (duty_date, assignment_id)
where deleted_at is null;

alter table public.cs_submission_photos
  add column if not exists public_url text;

create table if not exists public.cs_live_updates (
  duty_date date primary key,
  changed_at timestamptz not null default now(),
  change_id uuid not null default gen_random_uuid()
);

alter table public.cs_live_updates enable row level security;
alter table public.cs_live_updates replica identity full;
revoke all on public.cs_live_updates from anon, authenticated;
grant select on public.cs_live_updates to anon, authenticated;

drop policy if exists cs_live_updates_select on public.cs_live_updates;
create policy cs_live_updates_select on public.cs_live_updates
for select to anon, authenticated using (true);

create or replace function private.cs_bangkok_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Bangkok')::date;
$$;

create or replace function private.cs_can_submit_assignment(p_assignment_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.cs_is_admin())
    or (
      p_date = (select private.cs_bangkok_today())
      and exists (
        select 1
        from public.cs_team_area_assignments a
        join public.cs_school_terms t on t.id = a.term_id
        where a.id = p_assignment_id
          and a.active = true
          and t.active = true
          and p_date between t.start_date and t.end_date
          and a.team_id = (select private.cs_current_team_id())
          and a.team_id = (select private.cs_scheduled_team_on(p_date))
      )
    );
$$;

create or replace function private.cs_can_evaluate_assignment(p_assignment_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.cs_is_admin())
    or (
      p_date = (select private.cs_bangkok_today())
      and (select private.cs_current_team_id()) is not null
      and exists (
        select 1
        from public.cs_team_area_assignments a
        join public.cs_school_terms t on t.id = a.term_id
        where a.id = p_assignment_id
          and a.active = true
          and t.active = true
          and p_date between t.start_date and t.end_date
          and a.team_id = (select private.cs_scheduled_team_on(p_date))
      )
    );
$$;

create or replace function private.cs_can_manage_public_photo_path(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folders text[];
  v_date date;
  v_assignment_id uuid;
begin
  if (select private.cs_is_admin()) then
    return true;
  end if;
  v_folders := storage.foldername(p_name);
  if array_length(v_folders, 1) < 3 then
    return false;
  end if;
  v_date := v_folders[1]::date;
  v_assignment_id := v_folders[2]::uuid;
  if v_folders[3] <> (select auth.uid())::text then
    return false;
  end if;
  return (select private.cs_can_submit_assignment(v_assignment_id, v_date));
exception when others then
  return false;
end;
$$;

create or replace function private.cs_prepare_evaluation_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if tg_op = 'INSERT' then
    new.evaluated_by := (select auth.uid());
    new.updated_by := (select auth.uid());
    new.evaluated_at := now();
  else
    if new.assignment_id <> old.assignment_id
       or new.duty_date <> old.duty_date
       or new.evaluator_team_id <> old.evaluator_team_id then
      raise exception 'Assignment, duty date and evaluator team cannot be changed';
    end if;
    new.evaluated_by := old.evaluated_by;
    new.updated_by := (select auth.uid());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop policy if exists cs_evaluations_insert on public.cs_evaluations;
create policy cs_evaluations_insert on public.cs_evaluations
for insert to authenticated
with check (
  evaluated_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and deleted_at is null
  and (
    (select private.cs_is_admin())
    or (
      evaluator_team_id = (select private.cs_current_team_id())
      and (select private.cs_can_evaluate_assignment(assignment_id, duty_date))
    )
  )
);

drop policy if exists cs_evaluations_update on public.cs_evaluations;
create policy cs_evaluations_update on public.cs_evaluations
for update to authenticated
using (
  (select private.cs_is_admin())
  or (
    evaluator_team_id = (select private.cs_current_team_id())
    and (select private.cs_can_evaluate_assignment(assignment_id, duty_date))
    and deleted_at is null
  )
)
with check (
  (select private.cs_is_admin())
  or (
    evaluator_team_id = (select private.cs_current_team_id())
    and (select private.cs_can_evaluate_assignment(assignment_id, duty_date))
    and deleted_at is null
  )
);

drop policy if exists cs_published_storage_insert on storage.objects;
create policy cs_published_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'cs-published-photos'
  and (select private.cs_can_manage_public_photo_path(name))
);

drop policy if exists cs_published_storage_select on storage.objects;
create policy cs_published_storage_select on storage.objects
for select to authenticated
using (bucket_id = 'cs-published-photos');

drop policy if exists cs_published_storage_update on storage.objects;
create policy cs_published_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'cs-published-photos'
  and (select private.cs_can_manage_public_photo_path(name))
)
with check (
  bucket_id = 'cs-published-photos'
  and (select private.cs_can_manage_public_photo_path(name))
);

drop policy if exists cs_published_storage_delete on storage.objects;
create policy cs_published_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'cs-published-photos'
  and (select private.cs_can_manage_public_photo_path(name))
);

create or replace function public.cs_save_live_submission(
  p_assignment_id uuid,
  p_duty_date date,
  p_duty_status public.cs_duty_status,
  p_student_count integer,
  p_note text
)
returns public.cs_duty_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.cs_duty_submissions;
  v_count integer;
begin
  if not (select private.cs_can_submit_assignment(p_assignment_id, p_duty_date)) then
    raise exception 'You cannot edit this duty area';
  end if;
  v_count := case when p_duty_status = 'present' then greatest(coalesce(p_student_count, 0), 0) else 0 end;
  if v_count > 1000 then
    raise exception 'Student count must be between 0 and 1000';
  end if;

  insert into public.cs_duty_submissions (
    assignment_id, duty_date, duty_status, student_count, note,
    workflow_status, submitted_by, updated_by
  ) values (
    p_assignment_id, p_duty_date, p_duty_status, v_count, nullif(trim(coalesce(p_note, '')), ''),
    'draft', (select auth.uid()), (select auth.uid())
  )
  on conflict (assignment_id, duty_date) where deleted_at is null
  do update set
    duty_status = excluded.duty_status,
    student_count = excluded.student_count,
    note = excluded.note,
    updated_by = (select auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.cs_ensure_live_submission(
  p_assignment_id uuid,
  p_duty_date date
)
returns public.cs_duty_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.cs_duty_submissions;
begin
  if not (select private.cs_can_submit_assignment(p_assignment_id, p_duty_date)) then
    raise exception 'You cannot edit this duty area';
  end if;

  select * into v_row
  from public.cs_duty_submissions
  where assignment_id = p_assignment_id
    and duty_date = p_duty_date
    and deleted_at is null
  limit 1;

  if v_row.id is null then
    insert into public.cs_duty_submissions (
      assignment_id, duty_date, duty_status, student_count, workflow_status,
      submitted_by, updated_by
    ) values (
      p_assignment_id, p_duty_date, 'present', 0, 'draft',
      (select auth.uid()), (select auth.uid())
    ) returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.cs_save_live_evaluation(
  p_assignment_id uuid,
  p_duty_date date,
  p_evaluator_team_id text,
  p_score numeric,
  p_reason text
)
returns public.cs_evaluations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.cs_evaluations;
  v_submission_id uuid;
begin
  if p_score < 0 or p_score > 10 then
    raise exception 'Score must be between 0 and 10';
  end if;
  if mod(p_score * 2, 1) <> 0 then
    raise exception 'Score must use 0.5 increments';
  end if;
  if not (
    (select private.cs_is_admin())
    or (
      p_evaluator_team_id = (select private.cs_current_team_id())
      and (select private.cs_can_evaluate_assignment(p_assignment_id, p_duty_date))
    )
  ) then
    raise exception 'You cannot evaluate this duty area';
  end if;

  select id into v_submission_id
  from public.cs_duty_submissions
  where assignment_id = p_assignment_id
    and duty_date = p_duty_date
    and deleted_at is null
  limit 1;

  insert into public.cs_evaluations (
    submission_id, assignment_id, duty_date, evaluator_team_id,
    score, reason, evaluated_by, updated_by
  ) values (
    v_submission_id, p_assignment_id, p_duty_date, p_evaluator_team_id,
    p_score, nullif(trim(coalesce(p_reason, '')), ''), (select auth.uid()), (select auth.uid())
  )
  on conflict (assignment_id, duty_date, evaluator_team_id) where deleted_at is null
  do update set
    submission_id = coalesce(excluded.submission_id, public.cs_evaluations.submission_id),
    score = excluded.score,
    reason = excluded.reason,
    updated_by = (select auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.cs_admin_delete_live_evaluation(p_evaluation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.cs_is_admin()) then
    raise exception 'Admin permission required';
  end if;
  update public.cs_evaluations
  set deleted_at = now(), updated_by = (select auth.uid())
  where id = p_evaluation_id and deleted_at is null;
end;
$$;

create or replace function public.cs_delete_live_photo(p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo public.cs_submission_photos;
  v_submission public.cs_duty_submissions;
begin
  select * into v_photo from public.cs_submission_photos where id = p_photo_id and deleted_at is null;
  if v_photo.id is null then raise exception 'Photo not found'; end if;
  select * into v_submission from public.cs_duty_submissions where id = v_photo.submission_id;
  if not (
    (select private.cs_is_admin())
    or (select private.cs_can_submit_assignment(v_submission.assignment_id, v_submission.duty_date))
  ) then
    raise exception 'You cannot delete this photo';
  end if;
  update public.cs_submission_photos set deleted_at = now() where id = p_photo_id;
  return v_photo.storage_path;
end;
$$;

create or replace function public.cs_public_live_overview(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with duty as (
    select (select private.cs_scheduled_team_on(p_date)) as team_id
  ), rule as (
    select attendance_target from public.cs_scoring_rules where active = true limit 1
  ), room_rows as (
    select
      a.id,
      a.area_id,
      a.room_label,
      a.sort_order,
      ar.code as area_code,
      ar.name as area_name,
      s.duty_status,
      s.student_count,
      s.note,
      ev.cleanliness_score,
      ev.evaluation_count,
      ev.reason_summary,
      case
        when s.id is null then null
        when s.duty_status = 'activity' then null
        when s.duty_status = 'absent' then 0
        else least(10, s.student_count::numeric / nullif(rule.attendance_target, 0) * 10)
      end::numeric(5,2) as attendance_score,
      coalesce(ph.photo_urls, '{}'::text[]) as photo_urls
    from duty
    join public.cs_team_area_assignments a on a.team_id = duty.team_id and a.active = true
    join public.cs_school_terms term on term.id = a.term_id and p_date between term.start_date and term.end_date
    join public.cs_areas ar on ar.id = a.area_id and ar.active = true
    cross join rule
    left join public.cs_duty_submissions s
      on s.assignment_id = a.id and s.duty_date = p_date and s.deleted_at is null
    left join lateral (
      select
        avg(e.score)::numeric(5,2) as cleanliness_score,
        count(*)::integer as evaluation_count,
        string_agg(distinct nullif(trim(e.reason), ''), ' • ') as reason_summary
      from public.cs_evaluations e
      where e.assignment_id = a.id and e.duty_date = p_date and e.deleted_at is null
    ) ev on true
    left join lateral (
      select array_agg(
        coalesce(p.public_url, p.legacy_public_url, p.legacy_thumbnail_url)
        order by p.sort_order, p.created_at
      ) filter (where coalesce(p.public_url, p.legacy_public_url, p.legacy_thumbnail_url) is not null) as photo_urls
      from public.cs_submission_photos p
      where p.submission_id = s.id and p.deleted_at is null and p.is_public = true
    ) ph on true
  ), team_score as (
    select
      avg(cleanliness_score) filter (
        where coalesce(duty_status, 'present'::public.cs_duty_status) = 'present'
      )::numeric(5,2) as cleanliness_score,
      avg(attendance_score) filter (where duty_status <> 'activity')::numeric(5,2) as attendance_score,
      coalesce(sum(evaluation_count), 0)::integer as evaluation_count
    from room_rows
  )
  select jsonb_build_object(
    'date', p_date,
    'scheduledTeam', (
      select to_jsonb(t) from public.cs_teams t join duty on duty.team_id = t.id where t.active = true
    ),
    'score', (
      select case
        when cleanliness_score is null and attendance_score is null then null
        else jsonb_build_object(
          'team_id', duty.team_id,
          'cleanliness_score', cleanliness_score,
          'attendance_score', attendance_score,
          'evaluation_count', evaluation_count
        )
      end
      from team_score cross join duty
    ),
    'rooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'area_id', r.area_id,
        'area_code', r.area_code,
        'area_name', r.area_name,
        'room_label', r.room_label,
        'duty_status', r.duty_status,
        'student_count', r.student_count,
        'note', r.note,
        'cleanliness_score', case when r.duty_status in ('absent', 'activity') then null else r.cleanliness_score end,
        'attendance_score', r.attendance_score,
        'evaluation_count', r.evaluation_count,
        'reason_summary', r.reason_summary,
        'photo_public_urls', to_jsonb(r.photo_urls)
      ) order by r.sort_order, r.room_label)
      from room_rows r
    ), '[]'::jsonb)
  );
$$;

create or replace function public.cs_admin_live_summary(
  p_start_date date,
  p_end_date date,
  p_team_ids text[] default null
)
returns table (
  score_date date,
  team_id text,
  cleanliness_score numeric,
  attendance_score numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    select private.cs_is_admin() as ok
  ), dates as (
    select d::date as score_date, private.cs_scheduled_team_on(d::date) as team_id
    from generate_series(p_start_date, p_end_date, interval '1 day') d
  ), rule as (
    select attendance_target from public.cs_scoring_rules where active = true limit 1
  ), rooms as (
    select
      dates.score_date,
      dates.team_id,
      s.duty_status,
      ev.cleanliness_score,
      case
        when s.id is null then null
        when s.duty_status = 'activity' then null
        when s.duty_status = 'absent' then 0
        else least(10, s.student_count::numeric / nullif(rule.attendance_target, 0) * 10)
      end::numeric as attendance_score
    from allowed
    join dates on allowed.ok and dates.team_id is not null
    join public.cs_team_area_assignments a on a.team_id = dates.team_id and a.active = true
    join public.cs_school_terms term on term.id = a.term_id and dates.score_date between term.start_date and term.end_date
    cross join rule
    left join public.cs_duty_submissions s
      on s.assignment_id = a.id and s.duty_date = dates.score_date and s.deleted_at is null
    left join lateral (
      select avg(e.score)::numeric as cleanliness_score
      from public.cs_evaluations e
      where e.assignment_id = a.id and e.duty_date = dates.score_date and e.deleted_at is null
    ) ev on true
    where p_team_ids is null or cardinality(p_team_ids) = 0 or dates.team_id = any(p_team_ids)
  )
  select
    rooms.score_date,
    rooms.team_id,
    avg(rooms.cleanliness_score) filter (
      where coalesce(rooms.duty_status, 'present'::public.cs_duty_status) = 'present'
    )::numeric(5,2),
    avg(rooms.attendance_score) filter (where rooms.duty_status <> 'activity')::numeric(5,2)
  from rooms
  group by rooms.score_date, rooms.team_id
  having avg(rooms.cleanliness_score) is not null or avg(rooms.attendance_score) is not null
  order by rooms.score_date, rooms.team_id;
$$;

create or replace function public.cs_admin_accounts()
returns table (
  id uuid,
  username text,
  display_name text,
  role public.cs_app_role,
  team_id text,
  team_name text,
  active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_activity_at timestamptz,
  submission_count bigint,
  evaluation_count bigint,
  photo_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.role,
    p.team_id,
    t.short_name,
    p.active,
    p.created_at,
    u.last_sign_in_at,
    greatest(p.updated_at, activity.last_activity_at) as last_activity_at,
    activity.submission_count,
    activity.evaluation_count,
    activity.photo_count
  from public.cs_profiles p
  join auth.users u on u.id = p.id
  left join public.cs_teams t on t.id = p.team_id
  cross join lateral (
    select
      greatest(
        coalesce((select max(s.updated_at) from public.cs_duty_submissions s where s.submitted_by = p.id or s.updated_by = p.id), '-infinity'::timestamptz),
        coalesce((select max(e.updated_at) from public.cs_evaluations e where e.evaluated_by = p.id or e.updated_by = p.id), '-infinity'::timestamptz),
        coalesce((select max(ph.updated_at) from public.cs_submission_photos ph where ph.uploaded_by = p.id), '-infinity'::timestamptz),
        coalesce((select max(a.created_at) from public.cs_audit_logs a where a.actor_id = p.id), '-infinity'::timestamptz)
      ) as last_activity_at,
      (select count(*) from public.cs_duty_submissions s where s.submitted_by = p.id and s.deleted_at is null) as submission_count,
      (select count(*) from public.cs_evaluations e where e.evaluated_by = p.id and e.deleted_at is null) as evaluation_count,
      (select count(*) from public.cs_submission_photos ph where ph.uploaded_by = p.id and ph.deleted_at is null) as photo_count
  ) activity
  where (select private.cs_is_admin())
  order by p.role, p.display_name;
$$;

create or replace function private.cs_touch_live_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  if tg_table_name = 'cs_duty_submissions' then
    v_date := coalesce(new.duty_date, old.duty_date);
  elsif tg_table_name = 'cs_evaluations' then
    v_date := coalesce(new.duty_date, old.duty_date);
  elsif tg_table_name = 'cs_submission_photos' then
    select s.duty_date into v_date
    from public.cs_duty_submissions s
    where s.id = coalesce(new.submission_id, old.submission_id);
  end if;

  if v_date is not null then
    insert into public.cs_live_updates (duty_date, changed_at, change_id)
    values (v_date, now(), gen_random_uuid())
    on conflict (duty_date) do update set changed_at = excluded.changed_at, change_id = excluded.change_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists cs_submissions_live_update on public.cs_duty_submissions;
create trigger cs_submissions_live_update after insert or update or delete on public.cs_duty_submissions
for each row execute function private.cs_touch_live_update();

drop trigger if exists cs_evaluations_live_update on public.cs_evaluations;
create trigger cs_evaluations_live_update after insert or update or delete on public.cs_evaluations
for each row execute function private.cs_touch_live_update();

drop trigger if exists cs_photos_live_update on public.cs_submission_photos;
create trigger cs_photos_live_update after insert or update or delete on public.cs_submission_photos
for each row execute function private.cs_touch_live_update();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cs_live_updates'
  ) then
    alter publication supabase_realtime add table public.cs_live_updates;
  end if;
end;
$$;

revoke all on function public.cs_save_live_submission(uuid, date, public.cs_duty_status, integer, text) from public, anon;
revoke all on function public.cs_ensure_live_submission(uuid, date) from public, anon;
revoke all on function public.cs_save_live_evaluation(uuid, date, text, numeric, text) from public, anon;
revoke all on function public.cs_admin_delete_live_evaluation(uuid) from public, anon;
revoke all on function public.cs_delete_live_photo(uuid) from public, anon;
revoke all on function public.cs_admin_live_summary(date, date, text[]) from public, anon;
revoke all on function public.cs_admin_accounts() from public, anon;
revoke all on function public.cs_public_live_overview(date) from public;

grant execute on function public.cs_save_live_submission(uuid, date, public.cs_duty_status, integer, text) to authenticated;
grant execute on function public.cs_ensure_live_submission(uuid, date) to authenticated;
grant execute on function public.cs_save_live_evaluation(uuid, date, text, numeric, text) to authenticated;
grant execute on function public.cs_admin_delete_live_evaluation(uuid) to authenticated;
grant execute on function public.cs_delete_live_photo(uuid) to authenticated;
grant execute on function public.cs_admin_live_summary(date, date, text[]) to authenticated;
grant execute on function public.cs_admin_accounts() to authenticated;
grant execute on function public.cs_public_live_overview(date) to anon, authenticated;

revoke all on function private.cs_bangkok_today() from public, anon;
revoke all on function private.cs_can_evaluate_assignment(uuid, date) from public, anon;
revoke all on function private.cs_can_manage_public_photo_path(text) from public, anon;
grant execute on function private.cs_bangkok_today() to authenticated;
grant execute on function private.cs_can_evaluate_assignment(uuid, date) to authenticated;
grant execute on function private.cs_can_manage_public_photo_path(text) to authenticated;

commit;
