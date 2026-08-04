-- Let INSERT ... RETURNING evaluate ownership from the candidate row itself.
-- The previous helper queried cs_duty_submissions by id before the new row was
-- visible to that nested query, so valid president inserts were rejected.

begin;

drop policy if exists cs_submissions_select on public.cs_duty_submissions;
create policy cs_submissions_select on public.cs_duty_submissions
for select to authenticated
using (
  (select private.cs_is_admin())
  or (
    deleted_at is null
    and exists (
      select 1
      from public.cs_team_area_assignments a
      where a.id = assignment_id
        and (
          a.team_id = (select private.cs_current_team_id())
          or (
            workflow_status in ('submitted', 'locked')
            and (select private.cs_is_active_user())
          )
        )
    )
  )
);

commit;
