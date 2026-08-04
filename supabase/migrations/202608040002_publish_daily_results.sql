-- Calculate and publish immutable daily snapshots from V3 submissions/evaluations.

begin;

create or replace function public.cs_admin_publish_day(p_score_date date)
returns table (team_count integer, room_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.cs_scoring_rules;
  v_team_count integer;
  v_room_count integer;
begin
  if not (select private.cs_is_admin()) then
    raise exception 'Admin permission required';
  end if;

  select * into v_rule
  from public.cs_scoring_rules
  where active = true
  limit 1;

  if v_rule.id is null then
    raise exception 'Active scoring rule not found';
  end if;

  if not exists (
    select 1 from public.cs_duty_submissions s
    where s.duty_date = p_score_date
      and s.deleted_at is null
      and s.workflow_status in ('submitted', 'locked')
  ) then
    raise exception 'No submitted duty records for this date';
  end if;

  perform set_config('app.audit_reason', 'Publish daily results ' || p_score_date::text, true);

  update public.cs_duty_submissions
  set workflow_status = 'locked', locked_at = coalesce(locked_at, now()), updated_by = (select auth.uid())
  where duty_date = p_score_date
    and deleted_at is null
    and workflow_status = 'submitted';

  with submission_metrics as (
    select
      s.id,
      a.team_id,
      s.duty_status,
      s.student_count,
      avg(e.score) filter (where e.deleted_at is null) as average_cleanliness,
      count(distinct e.evaluator_team_id) filter (where e.deleted_at is null) as evaluation_count
    from public.cs_duty_submissions s
    join public.cs_team_area_assignments a on a.id = s.assignment_id
    left join public.cs_evaluations e on e.submission_id = s.id
    where s.duty_date = p_score_date
      and s.deleted_at is null
      and s.workflow_status in ('submitted', 'locked')
    group by s.id, a.team_id, s.duty_status, s.student_count
  ), team_metrics as (
    select
      team_id,
      coalesce(avg(average_cleanliness) filter (where duty_status = 'present'), 0)::numeric(5,2) as cleanliness_score,
      coalesce(avg(
        case
          when duty_status = 'activity' then null
          when duty_status = 'absent' then 0
          else least(10, student_count::numeric / v_rule.attendance_target * 10)
        end
      ), 0)::numeric(5,2) as attendance_score,
      coalesce(least(
        10,
        sum(evaluation_count) filter (where duty_status = 'present')::numeric
          / nullif(count(*) filter (where duty_status = 'present') * v_rule.evaluator_count, 0)
          * 10
      ), 0)::numeric(5,2) as completeness_score
    from submission_metrics
    group by team_id
  )
  insert into public.cs_daily_team_scores (
    score_date, team_id, scoring_rule_id,
    cleanliness_score, attendance_score, completeness_score,
    is_final, calculated_at, published_at
  )
  select
    p_score_date, team_id, v_rule.id,
    cleanliness_score, attendance_score, completeness_score,
    true, now(), now()
  from team_metrics
  on conflict (score_date, team_id, scoring_rule_id) do update set
    cleanliness_score = excluded.cleanliness_score,
    attendance_score = excluded.attendance_score,
    completeness_score = excluded.completeness_score,
    is_final = true,
    calculated_at = now(),
    published_at = now();

  get diagnostics v_team_count = row_count;

  update public.cs_published_room_results
  set published_at = null, updated_at = now()
  where score_date = p_score_date;

  with room_metrics as (
    select
      s.id as submission_id,
      a.team_id,
      a.area_id,
      a.room_label,
      s.duty_status,
      case
        when s.duty_status = 'activity' then null
        else avg(e.score) filter (where e.deleted_at is null)
      end::numeric(5,2) as cleanliness_score,
      case
        when s.duty_status = 'activity' then null
        when s.duty_status = 'absent' then 0
        else least(10, s.student_count::numeric / v_rule.attendance_target * 10)
      end::numeric(5,2) as attendance_score,
      string_agg(distinct nullif(trim(e.reason), ''), ' • ') filter (where e.deleted_at is null) as reason_summary
    from public.cs_duty_submissions s
    join public.cs_team_area_assignments a on a.id = s.assignment_id
    left join public.cs_evaluations e on e.submission_id = s.id
    where s.duty_date = p_score_date
      and s.deleted_at is null
      and s.workflow_status = 'locked'
    group by s.id, a.team_id, a.area_id, a.room_label, s.duty_status, s.student_count
  )
  insert into public.cs_published_room_results (
    score_date, team_id, area_id, room_label, duty_status,
    cleanliness_score, attendance_score, reason_summary, photo_ids,
    published_at, updated_at
  )
  select
    p_score_date, r.team_id, r.area_id, r.room_label, r.duty_status,
    r.cleanliness_score, r.attendance_score, r.reason_summary,
    coalesce((
      select array_agg(p.id order by p.sort_order, p.created_at)
      from public.cs_submission_photos p
      where p.submission_id = r.submission_id and p.deleted_at is null and p.is_public = true
    ), '{}'::uuid[]),
    now(), now()
  from room_metrics r
  on conflict (score_date, team_id, area_id) do update set
    room_label = excluded.room_label,
    duty_status = excluded.duty_status,
    cleanliness_score = excluded.cleanliness_score,
    attendance_score = excluded.attendance_score,
    reason_summary = excluded.reason_summary,
    photo_ids = excluded.photo_ids,
    published_at = now(),
    updated_at = now();

  get diagnostics v_room_count = row_count;
  return query select v_team_count, v_room_count;
end;
$$;

revoke all on function public.cs_admin_publish_day(date) from public, anon;
grant execute on function public.cs_admin_publish_day(date) to authenticated;

commit;
