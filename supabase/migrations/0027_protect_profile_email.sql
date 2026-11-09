-- Email addresses are not part of the team directory. RLS filters rows, not
-- columns, so table-level SELECT grants would expose email on every readable
-- teammate profile. Preserve the existing row policy and grant only the
-- profile columns used by the application.
revoke all privileges on table public.profiles from anon, authenticated;

grant select (
  id,
  full_name,
  username,
  avatar_url,
  bio,
  github_username,
  github_profile_url,
  created_at,
  updated_at,
  capstone_repository_url
) on table public.profiles to authenticated;

grant update (
  full_name,
  username,
  avatar_url,
  bio,
  github_username,
  github_profile_url,
  timezone,
  capstone_repository_url
) on table public.profiles to authenticated;

comment on column public.profiles.email is
  'Private account email. Use the authenticated user email for self-service; do not expose through team profile queries.';

create or replace function public.get_my_profile_timezone()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p.timezone
  from public.profiles as p
  where p.id = auth.uid()
$$;

revoke all on function public.get_my_profile_timezone() from public, anon;
grant execute on function public.get_my_profile_timezone() to authenticated;
