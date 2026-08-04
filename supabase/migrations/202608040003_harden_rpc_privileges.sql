-- Supabase may have explicit default EXECUTE grants for API roles.
-- Keep every V3 RPC unavailable to anon even when the function also checks roles internally.

begin;

revoke all on function public.cs_update_my_profile(text) from public, anon;
revoke all on function public.cs_admin_void_submission(uuid, text) from public, anon;
revoke all on function public.cs_admin_void_evaluation(uuid, text) from public, anon;
revoke all on function public.cs_admin_publish_day(date) from public, anon;

grant execute on function public.cs_update_my_profile(text) to authenticated;
grant execute on function public.cs_admin_void_submission(uuid, text) to authenticated;
grant execute on function public.cs_admin_void_evaluation(uuid, text) to authenticated;
grant execute on function public.cs_admin_publish_day(date) to authenticated;

commit;
