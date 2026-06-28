-- ระบบตรวจความสะอาดคณะสี V2
-- Run in Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.color_teams (
  id text primary key,
  name text not null,
  short_name text not null,
  color_name text not null,
  accent_color text not null,
  soft_color text not null,
  duty_day text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  role text not null check (role in ('ADMIN', 'PRESIDENT')),
  color_team_id text references public.color_teams(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.duty_areas (
  id text primary key,
  area_no int not null,
  area_name text not null,
  rooms_by_team jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.duty_records (
  id text primary key,
  record_date date not null,
  area_id text not null references public.duty_areas(id) on delete cascade,
  room text not null,
  duty_color_id text not null references public.color_teams(id),
  status text not null check (status in ('PRESENT', 'ABSENT', 'ACTIVITY')),
  student_count int not null default 0,
  student_score numeric(5,2) not null default 0,
  photo_url text,
  photo_thumb_url text,
  photo_path text,
  photo_thumb_path text,
  photo_note text,
  submitted_by uuid references auth.users(id),
  submitted_name text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_date, area_id, duty_color_id)
);

create table if not exists public.clean_scores (
  id text primary key,
  record_date date not null,
  area_id text not null references public.duty_areas(id) on delete cascade,
  room text not null,
  duty_color_id text not null references public.color_teams(id),
  evaluator_color_id text not null references public.color_teams(id),
  clean_score numeric(4,2) not null check (clean_score >= 0 and clean_score <= 10),
  score_note text,
  submitted_by uuid references auth.users(id),
  submitted_name text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_date, area_id, duty_color_id, evaluator_color_id)
);

create table if not exists public.edit_logs (
  id text primary key,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  edited_by text,
  edited_at timestamptz not null default now()
);

create index if not exists idx_duty_records_date on public.duty_records(record_date);
create index if not exists idx_duty_records_team on public.duty_records(duty_color_id);
create index if not exists idx_clean_scores_date on public.clean_scores(record_date);
create index if not exists idx_clean_scores_team on public.clean_scores(duty_color_id);
create index if not exists idx_clean_scores_evaluator on public.clean_scores(evaluator_color_id);

alter table public.color_teams enable row level security;
alter table public.profiles enable row level security;
alter table public.duty_areas enable row level security;
alter table public.duty_records enable row level security;
alter table public.clean_scores enable row level security;
alter table public.edit_logs enable row level security;

drop policy if exists "public read color teams" on public.color_teams;
create policy "public read color teams"
on public.color_teams for select
to anon, authenticated
using (true);

drop policy if exists "public read duty areas" on public.duty_areas;
create policy "public read duty areas"
on public.duty_areas for select
to anon, authenticated
using (true);

drop policy if exists "public read duty records" on public.duty_records;
create policy "public read duty records"
on public.duty_records for select
to anon, authenticated
using (true);

drop policy if exists "public read clean scores" on public.clean_scores;
create policy "public read clean scores"
on public.clean_scores for select
to anon, authenticated
using (true);

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "authenticated write duty records" on public.duty_records;
create policy "authenticated write duty records"
on public.duty_records for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated write clean scores" on public.clean_scores;
create policy "authenticated write clean scores"
on public.clean_scores for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated write edit logs" on public.edit_logs;
create policy "authenticated write edit logs"
on public.edit_logs for insert
to authenticated
with check (true);

drop policy if exists "authenticated read edit logs" on public.edit_logs;
create policy "authenticated read edit logs"
on public.edit_logs for select
to authenticated
using (true);


drop policy if exists "authenticated delete edit logs" on public.edit_logs;
create policy "authenticated delete edit logs"
on public.edit_logs for delete
to authenticated
using (true);

drop policy if exists "authenticated write duty areas" on public.duty_areas;
create policy "authenticated write duty areas"
on public.duty_areas for all
to authenticated
using (true)
with check (true);

-- Storage bucket for area photos
insert into storage.buckets (id, name, public)
values ('area-photos', 'area-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public read area photos" on storage.objects;
create policy "public read area photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'area-photos');

drop policy if exists "authenticated upload area photos" on storage.objects;
create policy "authenticated upload area photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'area-photos');

drop policy if exists "authenticated update area photos" on storage.objects;
create policy "authenticated update area photos"
on storage.objects for update
to authenticated
using (bucket_id = 'area-photos')
with check (bucket_id = 'area-photos');


drop policy if exists "authenticated delete area photos" on storage.objects;
create policy "authenticated delete area photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'area-photos');
