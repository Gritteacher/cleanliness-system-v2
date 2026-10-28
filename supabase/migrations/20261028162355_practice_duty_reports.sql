-- Separate from cleanliness: no existing data, schedules, or scores are modified.
create table public.cs_practice_reports (
  id uuid primary key,
  duty_date date not null check (duty_date between date '2026-11-02' and date '2026-11-30' and duty_date <> date '2026-11-07'),
  team_id text not null references public.cs_teams(id) check (team_id in ('maen','yaowaman','nipha','piyarat','phanu')),
  teacher_name text not null check (length(trim(teacher_name)) between 2 and 120),
  outcome text not null check (outcome in ('normal','incident')),
  details text not null check (length(trim(details)) between 1 and 3000),
  action_taken text not null default '' check (length(action_taken) <= 2000),
  start_time time,
  end_time time not null,
  confirmed boolean not null check (confirmed),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 6),
  status text not null default 'pending' check (status in ('pending','published')),
  created_at timestamptz not null default now(),
  check (status <> 'published' or jsonb_array_length(photos) between 1 and 6),
  check (outcome <> 'incident' or length(trim(action_taken)) > 0),
  check (case when extract(isodow from duty_date) in (6,7) then start_time is not distinct from time '08:00' and end_time = time '16:00' else start_time is null and end_time = case when duty_date <= date '2026-11-15' then time '19:00' else time '20:00' end end)
);
create index cs_practice_reports_day_created on public.cs_practice_reports (duty_date, created_at desc, id) where status = 'published';
create index cs_practice_reports_team on public.cs_practice_reports (team_id);
alter table public.cs_practice_reports enable row level security;
revoke all on public.cs_practice_reports from public, anon, authenticated;
grant select on public.cs_practice_reports to anon, authenticated;
grant all on public.cs_practice_reports to service_role;
create policy practice_reports_public_read on public.cs_practice_reports for select to anon, authenticated using (status = 'published');

-- Service-only counters. No IP address is stored: the Edge Function sends a salted hash.
create table public.cs_practice_rate_limits (
  source_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (source_hash, window_start)
);
alter table public.cs_practice_rate_limits enable row level security;
revoke all on public.cs_practice_rate_limits from public, anon, authenticated;
grant all on public.cs_practice_rate_limits to service_role;
create function public.cs_practice_claim_rate(p_source text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v_window timestamptz := date_bin('10 minutes',now(),timestamptz '2026-01-01'); v_hits integer;
begin
  if p_source !~ '^[a-f0-9]{64}$' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_source,0));
  select coalesce(sum(hits),0) into v_hits from public.cs_practice_rate_limits where source_hash=p_source and window_start > now()-interval '24 hours';
  if v_hits >= 150 then return false; end if;
  insert into public.cs_practice_rate_limits(source_hash,window_start,hits) values(p_source,v_window,1)
  on conflict(source_hash,window_start) do update set hits=public.cs_practice_rate_limits.hits+1 where public.cs_practice_rate_limits.hits < 20 returning hits into v_hits;
  delete from public.cs_practice_rate_limits where window_start < now()-interval '2 days';
  return v_hits is not null;
end;
$$;
revoke all on function public.cs_practice_claim_rate(text) from public,anon,authenticated;
grant execute on function public.cs_practice_claim_rate(text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('practice-duty-photos','practice-duty-photos',true,524288,array['image/webp']);
-- Intentionally no client INSERT/UPDATE/DELETE policy for this bucket.
-- All uploads are validated and performed by the service-only Edge Function.
alter publication supabase_realtime add table public.cs_practice_reports;
