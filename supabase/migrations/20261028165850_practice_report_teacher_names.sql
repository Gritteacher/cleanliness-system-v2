-- Keep teacher_name as the first teacher for older clients; new clients read the list.
alter table public.cs_practice_reports add column teacher_names text[];
alter table public.cs_practice_reports add constraint cs_practice_report_teacher_names_valid check (
  teacher_names is null or (
    array_ndims(teacher_names) = 1 and array_lower(teacher_names,1) = 1
    and cardinality(teacher_names) between 1 and 3
    and array_position(teacher_names,null) is null
    and length(trim(teacher_names[1])) between 2 and 120
    and (cardinality(teacher_names) < 2 or length(trim(teacher_names[2])) between 2 and 120)
    and (cardinality(teacher_names) < 3 or length(trim(teacher_names[3])) between 2 and 120)
    and teacher_names[1] = teacher_name
  )
);
update public.cs_practice_reports set teacher_names = array[teacher_name] where teacher_names is null;
-- NULL remains accepted for requests from a previous frontend/Edge version during rollout.
-- Existing RLS policies and write privileges are unchanged.
