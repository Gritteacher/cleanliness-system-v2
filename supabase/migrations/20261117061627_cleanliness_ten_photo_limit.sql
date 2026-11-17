-- Existing photos and edit permissions are preserved. One active submission
-- already identifies an assignment/day. Serialize only that submission's adds.
create or replace function private.cs_enforce_ten_photos()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if new.deleted_at is not null then return new; end if;
  if tg_op = 'UPDATE' then
    if old.deleted_at is null and old.submission_id = new.submission_id then
      return new;
    end if;
  end if;
  perform 1 from public.cs_duty_submissions
  where id = new.submission_id and deleted_at is null for update;
  if not found then
    raise exception using errcode = '42501', message = 'Submission is unavailable';
  end if;
  select count(*) into v_count from public.cs_submission_photos
  where submission_id = new.submission_id and deleted_at is null
    and id is distinct from new.id;
  if v_count >= 10 then
    raise exception using errcode = '23514', message = 'CLEANLINESS_PHOTO_LIMIT',
      detail = 'Maximum 10 active photos per area per day';
  end if;
  return new;
end;
$$;
revoke all on function private.cs_enforce_ten_photos() from public, anon, authenticated;
create trigger cs_photo_limit_ten
before insert or update of submission_id, deleted_at on public.cs_submission_photos
for each row execute function private.cs_enforce_ten_photos();
