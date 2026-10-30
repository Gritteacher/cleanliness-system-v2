-- Scheduled teachers are separate from submitted reports. Importing the roster
-- must never create a report, mark a team complete, or change an existing report.
create table public.cs_practice_duty_roster (
  duty_date date not null check (duty_date between date '2026-11-02' and date '2026-11-30' and duty_date <> date '2026-11-07'),
  team_id text not null references public.cs_teams(id),
  teacher_names text[] not null check (
    coalesce(array_ndims(teacher_names) = 1 and array_lower(teacher_names,1) = 1
    and cardinality(teacher_names) between 1 and 4
    and array_position(teacher_names,null) is null
    and length(trim(teacher_names[1])) between 2 and 120
    and (cardinality(teacher_names)<2 or length(trim(teacher_names[2])) between 2 and 120)
    and (cardinality(teacher_names)<3 or length(trim(teacher_names[3])) between 2 and 120)
    and (cardinality(teacher_names)<4 or length(trim(teacher_names[4])) between 2 and 120),false)
  ),
  source_name text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_page integer not null check (source_page between 1 and 10),
  imported_at timestamptz not null default now(),
  primary key(duty_date,team_id)
);
create index cs_practice_roster_team on public.cs_practice_duty_roster(team_id);
alter table public.cs_practice_duty_roster enable row level security;
revoke all on public.cs_practice_duty_roster from public,anon,authenticated;
grant select(duty_date,team_id,teacher_names) on public.cs_practice_duty_roster to anon,authenticated;
grant select,insert,update,delete on public.cs_practice_duty_roster to service_role;
create policy practice_roster_read on public.cs_practice_duty_roster for select to anon,authenticated using (true);

-- November 30 has four teachers on the blue team in the supplied draft.
alter table public.cs_practice_reports drop constraint cs_practice_report_teacher_names_valid;
alter table public.cs_practice_reports add constraint cs_practice_report_teacher_names_valid check (
  teacher_names is null or coalesce(
    array_ndims(teacher_names)=1 and array_lower(teacher_names,1)=1
    and cardinality(teacher_names) between 1 and 4
    and array_position(teacher_names,null) is null
    and length(trim(teacher_names[1])) between 2 and 120
    and (cardinality(teacher_names)<2 or length(trim(teacher_names[2])) between 2 and 120)
    and (cardinality(teacher_names)<3 or length(trim(teacher_names[3])) between 2 and 120)
    and (cardinality(teacher_names)<4 or length(trim(teacher_names[4])) between 2 and 120)
    and teacher_names[1]=teacher_name,false)
);
