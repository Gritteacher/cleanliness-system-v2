-- Cleanliness System V3 foundation
-- Safe to run alongside the existing V2 tables: all new public objects use cs_ prefix.

begin;

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.cs_app_role as enum ('admin', 'president');
create type public.cs_duty_status as enum ('present', 'absent', 'activity');
create type public.cs_workflow_status as enum ('draft', 'submitted', 'locked', 'void');
create type public.cs_report_status as enum ('queued', 'processing', 'completed', 'failed');

create table public.cs_teams (
  id text primary key,
  name text not null,
  short_name text not null,
  color_name text not null,
  accent_color text not null check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  soft_color text not null check (soft_color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cs_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username) and username ~ '^[a-z0-9._-]{3,50}$'),
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  role public.cs_app_role not null default 'president',
  team_id text references public.cs_teams(id) on delete restrict,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cs_profiles_role_team_check check (
    (role = 'admin' and team_id is null)
    or (role = 'president' and team_id is not null)
  )
);

create table public.cs_school_terms (
  id uuid primary key default gen_random_uuid(),
  academic_year integer not null check (academic_year between 2500 and 3000),
  semester smallint not null check (semester between 1 and 3),
  name text not null check (char_length(trim(name)) between 2 and 120),
  start_date date not null,
  end_date date not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year, semester),
  check (end_date >= start_date)
);

create unique index cs_school_terms_one_active_idx
on public.cs_school_terms (active)
where active = true;

create table public.cs_areas (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text not null unique check (char_length(trim(code)) between 1 and 50),
  name text not null check (char_length(trim(name)) between 2 and 160),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cs_team_area_assignments (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.cs_school_terms(id) on delete restrict,
  team_id text not null references public.cs_teams(id) on delete restrict,
  area_id uuid not null references public.cs_areas(id) on delete restrict,
  room_label text not null check (char_length(trim(room_label)) between 1 and 120),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, team_id, area_id)
);

create table public.cs_duty_schedules (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.cs_school_terms(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 5),
  team_id text not null references public.cs_teams(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, weekday),
  unique (term_id, team_id)
);

create table public.cs_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.cs_school_terms(id) on delete cascade,
  duty_date date not null,
  team_id text references public.cs_teams(id) on delete restrict,
  cancelled boolean not null default false,
  reason text not null check (char_length(trim(reason)) between 2 and 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, duty_date),
  check ((cancelled = true and team_id is null) or (cancelled = false and team_id is not null))
);

create table public.cs_duty_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.cs_team_area_assignments(id) on delete restrict,
  duty_date date not null,
  duty_status public.cs_duty_status not null default 'present',
  student_count integer not null default 0 check (student_count between 0 and 1000),
  note text check (note is null or char_length(note) <= 2000),
  workflow_status public.cs_workflow_status not null default 'draft',
  submitted_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz,
  locked_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (duty_status = 'present')
    or (duty_status in ('absent', 'activity') and student_count = 0)
  ),
  check (
    (workflow_status = 'draft' and submitted_at is null)
    or (workflow_status in ('submitted', 'locked', 'void'))
  )
);

create unique index cs_duty_submissions_active_assignment_date_idx
on public.cs_duty_submissions (assignment_id, duty_date)
where deleted_at is null;

create table public.cs_submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.cs_duty_submissions(id) on delete cascade,
  storage_path text not null unique,
  thumbnail_path text unique,
  sort_order integer not null default 0 check (sort_order between 0 and 20),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  is_public boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cs_evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.cs_duty_submissions(id) on delete cascade,
  evaluator_team_id text not null references public.cs_teams(id) on delete restrict,
  score numeric(4,2) not null check (score between 0 and 10),
  reason text check (reason is null or char_length(reason) <= 2000),
  evaluated_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  evaluated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cs_evaluations_active_submission_team_idx
on public.cs_evaluations (submission_id, evaluator_team_id)
where deleted_at is null;

create table public.cs_scoring_rules (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  name text not null,
  attendance_target integer not null default 15 check (attendance_target > 0),
  evaluator_count integer not null default 5 check (evaluator_count > 0),
  completeness_threshold numeric(5,4) not null default 0.8000 check (completeness_threshold > 0 and completeness_threshold <= 1),
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cs_scoring_rules_one_active_idx
on public.cs_scoring_rules (active)
where active = true;

create table public.cs_daily_team_scores (
  id uuid primary key default gen_random_uuid(),
  score_date date not null,
  team_id text not null references public.cs_teams(id) on delete restrict,
  scoring_rule_id uuid not null references public.cs_scoring_rules(id) on delete restrict,
  cleanliness_score numeric(5,2) not null default 0 check (cleanliness_score between 0 and 10),
  attendance_score numeric(5,2) not null default 0 check (attendance_score between 0 and 10),
  completeness_score numeric(5,2) not null default 0 check (completeness_score between 0 and 10),
  total_score numeric(5,2) generated always as (
    cleanliness_score + attendance_score + completeness_score
  ) stored,
  is_final boolean not null default false,
  calculated_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (score_date, team_id, scoring_rule_id)
);

create table public.cs_published_room_results (
  id uuid primary key default gen_random_uuid(),
  score_date date not null,
  team_id text not null references public.cs_teams(id) on delete restrict,
  area_id uuid not null references public.cs_areas(id) on delete restrict,
  room_label text not null,
  duty_status public.cs_duty_status not null,
  cleanliness_score numeric(5,2) check (cleanliness_score is null or cleanliness_score between 0 and 10),
  attendance_score numeric(5,2) check (attendance_score is null or attendance_score between 0 and 10),
  reason_summary text,
  photo_ids uuid[] not null default '{}',
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (score_date, team_id, area_id)
);

create table public.cs_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  reason text,
  request_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.cs_report_jobs (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  report_date date not null,
  status public.cs_report_status not null default 'queued',
  requested_by uuid references auth.users(id) on delete set null,
  file_path text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes used by common filters and RLS helpers.
create index cs_profiles_team_active_idx on public.cs_profiles (team_id, active);
create index cs_assignments_term_team_idx on public.cs_team_area_assignments (term_id, team_id) where active = true;
create index cs_schedules_term_weekday_idx on public.cs_duty_schedules (term_id, weekday);
create index cs_overrides_date_idx on public.cs_schedule_overrides (duty_date);
create index cs_submissions_date_idx on public.cs_duty_submissions (duty_date) where deleted_at is null;
create index cs_submissions_actor_idx on public.cs_duty_submissions (submitted_by);
create index cs_photos_submission_idx on public.cs_submission_photos (submission_id) where deleted_at is null;
create index cs_evaluations_submission_idx on public.cs_evaluations (submission_id) where deleted_at is null;
create index cs_evaluations_actor_idx on public.cs_evaluations (evaluated_by);
create index cs_daily_scores_public_idx on public.cs_daily_team_scores (score_date, published_at);
create index cs_room_results_public_idx on public.cs_published_room_results (score_date, published_at);
create index cs_audit_entity_idx on public.cs_audit_logs (entity_type, entity_id, created_at desc);

-- Generic timestamps.
create or replace function private.cs_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.cs_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cs_profiles p
    where p.id = (select auth.uid())
      and p.active = true
  );
$$;

create or replace function private.cs_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cs_profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.active = true
  );
$$;

create or replace function private.cs_current_team_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.team_id
  from public.cs_profiles p
  where p.id = (select auth.uid())
    and p.role = 'president'
    and p.active = true;
$$;

create or replace function private.cs_scheduled_team_on(p_date date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with active_term as (
    select t.id
    from public.cs_school_terms t
    where t.active = true
      and p_date between t.start_date and t.end_date
    limit 1
  ), matching_override as (
    select case when o.cancelled then null else o.team_id end as team_id
    from public.cs_schedule_overrides o
    join active_term t on t.id = o.term_id
    where o.duty_date = p_date
    limit 1
  )
  select case
    when exists (select 1 from matching_override)
    then (select team_id from matching_override)
    else (
      select s.team_id
      from public.cs_duty_schedules s
      join active_term t on t.id = s.term_id
      where s.weekday = extract(isodow from p_date)::smallint
      limit 1
    )
  end;
$$;

create or replace function private.cs_can_submit_assignment(p_assignment_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cs_team_area_assignments a
    join public.cs_school_terms t on t.id = a.term_id
    where a.id = p_assignment_id
      and a.active = true
      and t.active = true
      and p_date between t.start_date and t.end_date
      and a.team_id = (select private.cs_current_team_id())
      and a.team_id = (select private.cs_scheduled_team_on(p_date))
  );
$$;

create or replace function private.cs_can_read_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.cs_is_admin())
    or exists (
      select 1
      from public.cs_duty_submissions s
      join public.cs_team_area_assignments a on a.id = s.assignment_id
      where s.id = p_submission_id
        and s.deleted_at is null
        and (
          a.team_id = (select private.cs_current_team_id())
          or (
            s.workflow_status in ('submitted', 'locked')
            and (select private.cs_is_active_user())
          )
        )
    );
$$;

create or replace function private.cs_can_edit_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.cs_is_admin())
    or exists (
      select 1
      from public.cs_duty_submissions s
      join public.cs_team_area_assignments a on a.id = s.assignment_id
      where s.id = p_submission_id
        and s.deleted_at is null
        and s.locked_at is null
        and s.workflow_status in ('draft', 'submitted')
        and a.team_id = (select private.cs_current_team_id())
        and (select private.cs_can_submit_assignment(s.assignment_id, s.duty_date))
    );
$$;

create or replace function private.cs_can_evaluate_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.cs_is_admin())
    or exists (
      select 1
      from public.cs_duty_submissions s
      where s.id = p_submission_id
        and s.deleted_at is null
        and s.workflow_status = 'submitted'
        and s.duty_status = 'present'
        and (select private.cs_current_team_id()) is not null
    );
$$;

create or replace function private.cs_prepare_submission_write()
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
    new.submitted_by := (select auth.uid());
    new.updated_by := (select auth.uid());
    if new.workflow_status in ('submitted', 'locked', 'void') then
      new.submitted_at := coalesce(new.submitted_at, now());
    else
      new.submitted_at := null;
    end if;
  else
    if new.assignment_id <> old.assignment_id or new.duty_date <> old.duty_date then
      raise exception 'Assignment and duty date cannot be changed';
    end if;
    new.submitted_by := old.submitted_by;
    new.updated_by := (select auth.uid());
    if old.workflow_status = 'draft' and new.workflow_status in ('submitted', 'locked', 'void') then
      new.submitted_at := now();
    else
      new.submitted_at := old.submitted_at;
    end if;
  end if;

  new.updated_at := now();
  return new;
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
    if new.submission_id <> old.submission_id or new.evaluator_team_id <> old.evaluator_team_id then
      raise exception 'Submission and evaluator team cannot be changed';
    end if;
    new.evaluated_by := old.evaluated_by;
    new.updated_by := (select auth.uid());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.cs_prepare_photo_write()
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
    new.uploaded_by := (select auth.uid());
  else
    new.uploaded_by := old.uploaded_by;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.cs_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_entity_id text;
  v_reason text;
begin
  if tg_op = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(new);
    v_entity_id := new.id::text;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_entity_id := new.id::text;
  else
    v_old := to_jsonb(old);
    v_new := null;
    v_entity_id := old.id::text;
  end if;

  v_reason := nullif(current_setting('app.audit_reason', true), '');

  insert into public.cs_audit_logs (
    actor_id, action, entity_type, entity_id, old_data, new_data, reason
  ) values (
    (select auth.uid()), tg_op, tg_table_name, v_entity_id, v_old, v_new, v_reason
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.cs_can_upload_photo_path(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folders text[];
  v_submission_id uuid;
begin
  v_folders := storage.foldername(p_name);
  if array_length(v_folders, 1) < 2 then
    return false;
  end if;
  if v_folders[2] <> (select auth.uid())::text then
    return false;
  end if;
  v_submission_id := v_folders[1]::uuid;
  return (select private.cs_can_edit_submission(v_submission_id));
exception when others then
  return false;
end;
$$;

create or replace function private.cs_can_read_photo_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.cs_is_admin())
    or exists (
      select 1
      from public.cs_submission_photos p
      where p.storage_path = p_name
        and p.deleted_at is null
        and (select private.cs_can_read_submission(p.submission_id))
    );
$$;

-- Apply automatic timestamps.
create trigger cs_teams_updated_at before update on public.cs_teams for each row execute function private.cs_set_updated_at();
create trigger cs_profiles_updated_at before update on public.cs_profiles for each row execute function private.cs_set_updated_at();
create trigger cs_terms_updated_at before update on public.cs_school_terms for each row execute function private.cs_set_updated_at();
create trigger cs_areas_updated_at before update on public.cs_areas for each row execute function private.cs_set_updated_at();
create trigger cs_assignments_updated_at before update on public.cs_team_area_assignments for each row execute function private.cs_set_updated_at();
create trigger cs_schedules_updated_at before update on public.cs_duty_schedules for each row execute function private.cs_set_updated_at();
create trigger cs_overrides_updated_at before update on public.cs_schedule_overrides for each row execute function private.cs_set_updated_at();
create trigger cs_rules_updated_at before update on public.cs_scoring_rules for each row execute function private.cs_set_updated_at();
create trigger cs_daily_scores_updated_at before update on public.cs_daily_team_scores for each row execute function private.cs_set_updated_at();
create trigger cs_room_results_updated_at before update on public.cs_published_room_results for each row execute function private.cs_set_updated_at();
create trigger cs_reports_updated_at before update on public.cs_report_jobs for each row execute function private.cs_set_updated_at();

create trigger cs_submission_actor before insert or update on public.cs_duty_submissions for each row execute function private.cs_prepare_submission_write();
create trigger cs_evaluation_actor before insert or update on public.cs_evaluations for each row execute function private.cs_prepare_evaluation_write();
create trigger cs_photo_actor before insert or update on public.cs_submission_photos for each row execute function private.cs_prepare_photo_write();

-- Auditing starts after seed/migration inserts below.

-- RLS on every exposed table.
alter table public.cs_teams enable row level security;
alter table public.cs_profiles enable row level security;
alter table public.cs_school_terms enable row level security;
alter table public.cs_areas enable row level security;
alter table public.cs_team_area_assignments enable row level security;
alter table public.cs_duty_schedules enable row level security;
alter table public.cs_schedule_overrides enable row level security;
alter table public.cs_duty_submissions enable row level security;
alter table public.cs_submission_photos enable row level security;
alter table public.cs_evaluations enable row level security;
alter table public.cs_scoring_rules enable row level security;
alter table public.cs_daily_team_scores enable row level security;
alter table public.cs_published_room_results enable row level security;
alter table public.cs_audit_logs enable row level security;
alter table public.cs_report_jobs enable row level security;

-- Explicit privileges. RLS further restricts rows.
revoke all on table
  public.cs_teams,
  public.cs_profiles,
  public.cs_school_terms,
  public.cs_areas,
  public.cs_team_area_assignments,
  public.cs_duty_schedules,
  public.cs_schedule_overrides,
  public.cs_duty_submissions,
  public.cs_submission_photos,
  public.cs_evaluations,
  public.cs_scoring_rules,
  public.cs_daily_team_scores,
  public.cs_published_room_results,
  public.cs_audit_logs,
  public.cs_report_jobs
from anon, authenticated;

grant select on public.cs_teams, public.cs_daily_team_scores, public.cs_published_room_results to anon;
grant select on
  public.cs_teams,
  public.cs_profiles,
  public.cs_school_terms,
  public.cs_areas,
  public.cs_team_area_assignments,
  public.cs_duty_schedules,
  public.cs_schedule_overrides,
  public.cs_duty_submissions,
  public.cs_submission_photos,
  public.cs_evaluations,
  public.cs_scoring_rules,
  public.cs_daily_team_scores,
  public.cs_published_room_results,
  public.cs_audit_logs,
  public.cs_report_jobs
to authenticated;
grant insert, update, delete on public.cs_teams, public.cs_school_terms, public.cs_areas,
  public.cs_team_area_assignments, public.cs_duty_schedules, public.cs_schedule_overrides,
  public.cs_scoring_rules, public.cs_daily_team_scores, public.cs_published_room_results,
  public.cs_report_jobs to authenticated;
grant insert, update on public.cs_duty_submissions, public.cs_evaluations to authenticated;
grant insert, update, delete on public.cs_submission_photos to authenticated;

-- Public reads only published snapshots and active team identity.
create policy cs_teams_public_select on public.cs_teams
for select to anon, authenticated
using (active = true);

create policy cs_scores_public_select on public.cs_daily_team_scores
for select to anon, authenticated
using (published_at is not null);

create policy cs_rooms_public_select on public.cs_published_room_results
for select to anon, authenticated
using (published_at is not null);

-- Profiles are never directly writable by application users.
create policy cs_profiles_select on public.cs_profiles
for select to authenticated
using (id = (select auth.uid()) or (select private.cs_is_admin()));

-- Active authenticated users may read master data. Only admins may modify it.
create policy cs_terms_select on public.cs_school_terms for select to authenticated
using ((select private.cs_is_active_user()));
create policy cs_areas_select on public.cs_areas for select to authenticated
using ((select private.cs_is_active_user()));
create policy cs_assignments_select on public.cs_team_area_assignments for select to authenticated
using ((select private.cs_is_active_user()));
create policy cs_schedules_select on public.cs_duty_schedules for select to authenticated
using ((select private.cs_is_active_user()));
create policy cs_overrides_select on public.cs_schedule_overrides for select to authenticated
using ((select private.cs_is_active_user()));
create policy cs_rules_select on public.cs_scoring_rules for select to authenticated
using ((select private.cs_is_active_user()));

create policy cs_teams_admin_all on public.cs_teams for all to authenticated
using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));
create policy cs_terms_admin_all on public.cs_school_terms for all to authenticated
using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));
create policy cs_areas_admin_all on public.cs_areas for all to authenticated
using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));
create policy cs_assignments_admin_all on public.cs_team_area_assignments for all to authenticated
using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));
create policy cs_schedules_admin_all on public.cs_duty_schedules for all to authenticated
using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));
create policy cs_overrides_admin_all on public.cs_schedule_overrides for all to authenticated
using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));
create policy cs_rules_admin_all on public.cs_scoring_rules for all to authenticated
using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));

-- Submission policies.
create policy cs_submissions_select on public.cs_duty_submissions
for select to authenticated
using ((select private.cs_can_read_submission(id)));

create policy cs_submissions_insert on public.cs_duty_submissions
for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (
    (select private.cs_is_admin())
    or (
      (select private.cs_can_submit_assignment(assignment_id, duty_date))
      and workflow_status in ('draft', 'submitted')
      and deleted_at is null
      and locked_at is null
    )
  )
);

create policy cs_submissions_update on public.cs_duty_submissions
for update to authenticated
using ((select private.cs_can_edit_submission(id)))
with check (
  (select private.cs_is_admin())
  or (
    (select private.cs_can_submit_assignment(assignment_id, duty_date))
    and workflow_status in ('draft', 'submitted')
    and deleted_at is null
    and locked_at is null
  )
);

-- Photo metadata policies.
create policy cs_photos_select on public.cs_submission_photos
for select to authenticated
using ((select private.cs_can_read_submission(submission_id)));

create policy cs_photos_insert on public.cs_submission_photos
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (select private.cs_can_edit_submission(submission_id))
);

create policy cs_photos_update on public.cs_submission_photos
for update to authenticated
using ((select private.cs_is_admin()) or (uploaded_by = (select auth.uid()) and (select private.cs_can_edit_submission(submission_id))))
with check ((select private.cs_is_admin()) or (uploaded_by = (select auth.uid()) and (select private.cs_can_edit_submission(submission_id))));

create policy cs_photos_delete on public.cs_submission_photos
for delete to authenticated
using ((select private.cs_is_admin()) or (uploaded_by = (select auth.uid()) and (select private.cs_can_edit_submission(submission_id))));

-- Evaluators see only their own team's individual scores; admins see all.
create policy cs_evaluations_select on public.cs_evaluations
for select to authenticated
using (
  deleted_at is null
  and (
    (select private.cs_is_admin())
    or evaluator_team_id = (select private.cs_current_team_id())
  )
);

create policy cs_evaluations_insert on public.cs_evaluations
for insert to authenticated
with check (
  evaluated_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (
    (select private.cs_is_admin())
    or (
      evaluator_team_id = (select private.cs_current_team_id())
      and (select private.cs_can_evaluate_submission(submission_id))
      and deleted_at is null
    )
  )
);

create policy cs_evaluations_update on public.cs_evaluations
for update to authenticated
using (
  (select private.cs_is_admin())
  or (
    evaluator_team_id = (select private.cs_current_team_id())
    and (select private.cs_can_evaluate_submission(submission_id))
    and deleted_at is null
  )
)
with check (
  (select private.cs_is_admin())
  or (
    evaluator_team_id = (select private.cs_current_team_id())
    and (select private.cs_can_evaluate_submission(submission_id))
    and deleted_at is null
  )
);

-- Admin-only system tables.
create policy cs_audit_admin_select on public.cs_audit_logs
for select to authenticated using ((select private.cs_is_admin()));
create policy cs_reports_admin_all on public.cs_report_jobs
for all to authenticated using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));
create policy cs_scores_admin_all on public.cs_daily_team_scores
for all to authenticated using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));
create policy cs_rooms_admin_all on public.cs_published_room_results
for all to authenticated using ((select private.cs_is_admin())) with check ((select private.cs_is_admin()));

-- Safe profile update RPC; role, team and active cannot be changed here.
create or replace function public.cs_update_my_profile(p_display_name text)
returns public.cs_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.cs_profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(p_display_name)) not between 2 and 120 then
    raise exception 'Display name must contain 2-120 characters';
  end if;

  update public.cs_profiles
  set display_name = trim(p_display_name), updated_at = now()
  where id = (select auth.uid()) and active = true
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Active profile not found';
  end if;
  return v_profile;
end;
$$;

create or replace function public.cs_admin_void_submission(p_submission_id uuid, p_reason text)
returns public.cs_duty_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.cs_duty_submissions;
begin
  if not (select private.cs_is_admin()) then
    raise exception 'Admin permission required';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 2 then
    raise exception 'A reason is required';
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.cs_duty_submissions
  set workflow_status = 'void', deleted_at = now(), updated_by = (select auth.uid())
  where id = p_submission_id and deleted_at is null
  returning * into v_submission;

  if v_submission.id is null then
    raise exception 'Submission not found';
  end if;
  return v_submission;
end;
$$;

create or replace function public.cs_admin_void_evaluation(p_evaluation_id uuid, p_reason text)
returns public.cs_evaluations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evaluation public.cs_evaluations;
begin
  if not (select private.cs_is_admin()) then
    raise exception 'Admin permission required';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 2 then
    raise exception 'A reason is required';
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.cs_evaluations
  set deleted_at = now(), updated_by = (select auth.uid())
  where id = p_evaluation_id and deleted_at is null
  returning * into v_evaluation;

  if v_evaluation.id is null then
    raise exception 'Evaluation not found';
  end if;
  return v_evaluation;
end;
$$;

revoke all on function public.cs_update_my_profile(text) from public;
revoke all on function public.cs_admin_void_submission(uuid, text) from public;
revoke all on function public.cs_admin_void_evaluation(uuid, text) from public;
grant execute on function public.cs_update_my_profile(text) to authenticated;
grant execute on function public.cs_admin_void_submission(uuid, text) to authenticated;
grant execute on function public.cs_admin_void_evaluation(uuid, text) to authenticated;

revoke all on all functions in schema private from public;
grant execute on function
  private.cs_is_active_user(),
  private.cs_is_admin(),
  private.cs_current_team_id(),
  private.cs_scheduled_team_on(date),
  private.cs_can_submit_assignment(uuid, date),
  private.cs_can_read_submission(uuid),
  private.cs_can_edit_submission(uuid),
  private.cs_can_evaluate_submission(uuid),
  private.cs_can_upload_photo_path(text),
  private.cs_can_read_photo_path(text)
to authenticated;

-- Seed team identity and the first scoring-rule version.
insert into public.cs_teams (id, name, short_name, color_name, accent_color, soft_color, sort_order)
values
  ('maen', 'คณะแม้นนฤมิตร', 'แม้นนฤมิตร', 'สีม่วง', '#7C3AED', '#F3E8FF', 1),
  ('yaowaman', 'คณะเยาวมาลย์อุทิศ', 'เยาวมาลย์อุทิศ', 'สีน้ำเงิน', '#2563EB', '#DBEAFE', 2),
  ('nipha', 'คณะนิภานภดล', 'นิภานภดล', 'สีแสด', '#F97316', '#FFEDD5', 3),
  ('piyarat', 'คณะปิยราชบพิตร', 'ปิยราชบพิตร', 'สีชมพู', '#EC4899', '#FCE7F3', 4),
  ('phanu', 'คณะภาณุรังษี', 'ภาณุรังษี', 'สีแดง', '#DC2626', '#FEE2E2', 5);

insert into public.cs_scoring_rules (
  version, name, attendance_target, evaluator_count, completeness_threshold, active
)
values ('v1', 'สูตรเริ่มต้นระบบ V3', 15, 5, 0.8000, true);

-- Migrate only identity/authorization data from V2. Never copy password_note.
insert into public.cs_profiles (id, username, display_name, role, team_id, active)
select
  p.id,
  lower(p.username),
  p.display_name,
  case when p.role = 'ADMIN' then 'admin'::public.cs_app_role else 'president'::public.cs_app_role end,
  p.color_team_id,
  true
from public.profiles p
where p.username is not null
on conflict (id) do nothing;

-- Audit all V3 changes after seed/migration data is in place.
create trigger cs_teams_audit after insert or update or delete on public.cs_teams for each row execute function private.cs_audit_row_change();
create trigger cs_profiles_audit after insert or update or delete on public.cs_profiles for each row execute function private.cs_audit_row_change();
create trigger cs_terms_audit after insert or update or delete on public.cs_school_terms for each row execute function private.cs_audit_row_change();
create trigger cs_areas_audit after insert or update or delete on public.cs_areas for each row execute function private.cs_audit_row_change();
create trigger cs_assignments_audit after insert or update or delete on public.cs_team_area_assignments for each row execute function private.cs_audit_row_change();
create trigger cs_schedules_audit after insert or update or delete on public.cs_duty_schedules for each row execute function private.cs_audit_row_change();
create trigger cs_overrides_audit after insert or update or delete on public.cs_schedule_overrides for each row execute function private.cs_audit_row_change();
create trigger cs_submissions_audit after insert or update or delete on public.cs_duty_submissions for each row execute function private.cs_audit_row_change();
create trigger cs_photos_audit after insert or update or delete on public.cs_submission_photos for each row execute function private.cs_audit_row_change();
create trigger cs_evaluations_audit after insert or update or delete on public.cs_evaluations for each row execute function private.cs_audit_row_change();
create trigger cs_rules_audit after insert or update or delete on public.cs_scoring_rules for each row execute function private.cs_audit_row_change();
create trigger cs_scores_audit after insert or update or delete on public.cs_daily_team_scores for each row execute function private.cs_audit_row_change();
create trigger cs_room_results_audit after insert or update or delete on public.cs_published_room_results for each row execute function private.cs_audit_row_change();

-- Private Storage bucket. Public pages must use signed URLs generated by a trusted server function.
insert into storage.buckets (id, name, public)
values ('cs-duty-photos', 'cs-duty-photos', false)
on conflict (id) do update set public = false;

create policy cs_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'cs-duty-photos'
  and ((select private.cs_can_read_photo_path(name)) or owner_id = (select auth.uid())::text)
);

create policy cs_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'cs-duty-photos'
  and owner_id = (select auth.uid())::text
  and (select private.cs_can_upload_photo_path(name))
);

create policy cs_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'cs-duty-photos'
  and ((select private.cs_is_admin()) or owner_id = (select auth.uid())::text)
)
with check (
  bucket_id = 'cs-duty-photos'
  and ((select private.cs_is_admin()) or (owner_id = (select auth.uid())::text and (select private.cs_can_upload_photo_path(name))))
);

create policy cs_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'cs-duty-photos'
  and ((select private.cs_is_admin()) or (owner_id = (select auth.uid())::text and (select private.cs_can_upload_photo_path(name))))
);

commit;
