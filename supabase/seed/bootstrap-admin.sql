-- ============================================================================
-- bootstrap-admin.sql  —  one-off, run ONCE in the Supabase SQL editor
--                        (runs as postgres, bypasses RLS)
--
-- Prerequisites:
--   1. Migration 0001_initial_schema.sql has been applied.
--   2. You have already registered at /register with the email below
--      (this creates your auth.users + profiles row via the trigger).
--
-- What it does:
--   * Creates the single launch team (idempotent).
--   * Promotes your profile to an active admin team member.
--
-- >>> Replace ahsan747708@gmail.com below with your registered email. <<<
-- ============================================================================

do $$
declare
  v_team_id uuid;
  v_user_id uuid;
  v_email   text := 'ahsan747708@gmail.com';
begin
  -- 1. Team
  insert into public.teams (name, slug, description)
  values ('Data Science Squad', 'data-science-squad',
          'Primary learning team — 24-week Data Science roadmap.')
  on conflict (slug) do update
    set name = excluded.name, description = excluded.description;

  select id into v_team_id from public.teams
    where slug = 'data-science-squad' limit 1;

  -- 2. Locate the profile created by the sign-up trigger
  select id into v_user_id from public.profiles where email = v_email;
  if v_user_id is null then
    raise exception 'No profile found for %. Register at /register first, then re-run this script.', v_email;
  end if;

  -- 3. Grant active admin membership (idempotent)
  insert into public.team_members (team_id, user_id, role, membership_status, joined_at)
  values (v_team_id, v_user_id, 'admin', 'active', now())
  on conflict (team_id, user_id) do update
    set role              = 'admin',
        membership_status = 'active',
        joined_at         = now(),
        suspended_at      = null,
        removed_at        = null;

  raise notice 'Admin membership granted to % for team %.', v_email, v_team_id;
end $$;
