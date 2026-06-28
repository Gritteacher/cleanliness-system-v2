-- Before running this file:
-- Go to Supabase Dashboard > Authentication > Users
-- Create users with these emails and chosen passwords:
-- admin@tsn.local
-- maen@tsn.local
-- yaowaman@tsn.local
-- nipha@tsn.local
-- piyarat@tsn.local
-- phanu@tsn.local
--
-- Then run this SQL to connect Auth users to system profiles.

insert into public.profiles (id, username, display_name, role, color_team_id)
select id, 'admin', 'ผู้ดูแลระบบ', 'ADMIN', null
from auth.users
where email = 'admin@tsn.local'
on conflict (id) do update set
username = excluded.username,
display_name = excluded.display_name,
role = excluded.role,
color_team_id = excluded.color_team_id,
updated_at = now();

insert into public.profiles (id, username, display_name, role, color_team_id)
select id, 'maen', 'ประธานคณะแม้นนฤมิตร', 'PRESIDENT', 'maen'
from auth.users
where email = 'maen@tsn.local'
on conflict (id) do update set
username = excluded.username,
display_name = excluded.display_name,
role = excluded.role,
color_team_id = excluded.color_team_id,
updated_at = now();

insert into public.profiles (id, username, display_name, role, color_team_id)
select id, 'yaowaman', 'ประธานคณะเยาวมาลย์อุทิศ', 'PRESIDENT', 'yaowaman'
from auth.users
where email = 'yaowaman@tsn.local'
on conflict (id) do update set
username = excluded.username,
display_name = excluded.display_name,
role = excluded.role,
color_team_id = excluded.color_team_id,
updated_at = now();

insert into public.profiles (id, username, display_name, role, color_team_id)
select id, 'nipha', 'ประธานคณะนิภานภดล', 'PRESIDENT', 'nipha'
from auth.users
where email = 'nipha@tsn.local'
on conflict (id) do update set
username = excluded.username,
display_name = excluded.display_name,
role = excluded.role,
color_team_id = excluded.color_team_id,
updated_at = now();

insert into public.profiles (id, username, display_name, role, color_team_id)
select id, 'piyarat', 'ประธานคณะปิยราชบพิตร', 'PRESIDENT', 'piyarat'
from auth.users
where email = 'piyarat@tsn.local'
on conflict (id) do update set
username = excluded.username,
display_name = excluded.display_name,
role = excluded.role,
color_team_id = excluded.color_team_id,
updated_at = now();

insert into public.profiles (id, username, display_name, role, color_team_id)
select id, 'phanu', 'ประธานคณะภาณุรังษี', 'PRESIDENT', 'phanu'
from auth.users
where email = 'phanu@tsn.local'
on conflict (id) do update set
username = excluded.username,
display_name = excluded.display_name,
role = excluded.role,
color_team_id = excluded.color_team_id,
updated_at = now();
