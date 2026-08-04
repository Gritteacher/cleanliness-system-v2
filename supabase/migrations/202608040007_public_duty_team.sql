-- Expose only the scheduled team id for a requested date to the public page.
-- The underlying schedules remain protected by RLS.

begin;

create or replace function public.cs_public_scheduled_team(p_date date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.cs_scheduled_team_on(p_date);
$$;

revoke all on function public.cs_public_scheduled_team(date) from public;
grant execute on function public.cs_public_scheduled_team(date) to anon, authenticated;

create index if not exists cs_daily_scores_team_date_published_idx
on public.cs_daily_team_scores (team_id, score_date)
where published_at is not null;

commit;
