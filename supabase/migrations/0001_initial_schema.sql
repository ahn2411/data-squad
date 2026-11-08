-- ============================================================================
-- Data Science Squad Hub — 0001_initial_schema.sql
-- Phase 1 + Phase 2: auth, profiles, teams, team_members, invitations.
--
-- Run via:  supabase db push   (or paste into the Supabase SQL editor)
--
-- Design rules enforced here:
--   * RLS is the real authorization layer. UI button-hiding is NOT authz.
--   * Never trust client-provided user ids — every policy uses auth.uid().
--   * A registered user is NOT an active member until an admin approves.
--   * Users cannot self-assign or change their own role or membership status.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums (D8 — full enum set is defined here; tables are added per phase)
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.team_role as enum ('admin', 'leader', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum
    ('pending_invite', 'pending_approval', 'active', 'suspended', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum
    ('sent', 'accepted', 'expired', 'revoked');
exception when duplicate_object then null; end $$;

-- Future-phase enums are declared here (cheap, typed) so all codegen stays
-- stable across migrations. Tables that use them arrive in later migrations.
do $$ begin
  create type public.phase_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.week_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.topic_status as enum
    ('locked', 'available', 'in_progress', 'completed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.topic_difficulty as enum
    ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.resource_type as enum
    ('article','video','book','documentation','course','tool','other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.assignment_type as enum
    ('programming_exercise','written_explanation','research_activity',
     'data_analysis','quiz','mini_project','group_project');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.assignment_difficulty as enum
    ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.submission_type as enum
    ('github_repo','github_pr','github_commit','external_url',
     'written','document','image','file');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.submission_status as enum
    ('not_started','in_progress','submitted','under_review',
     'revision_requested','approved','rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.review_status as enum
    ('pending','approved','revision_requested','rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.blocker_priority as enum
    ('low','medium','high','critical');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.blocker_status as enum
    ('open','being_addressed','resolved');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.publication_status as enum
    ('draft','published','archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.notification_type as enum
    ('new_assignment','deadline_approaching','submission_reviewed',
     'revision_requested','new_announcement','weekly_report_due',
     'blocker_updated');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- teams
-- ----------------------------------------------------------------------------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- profiles  (1:1 with auth.users, created by trigger below)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  full_name           text,
  username            text unique,
  avatar_url          text,
  bio                 text,
  github_username     text,
  github_profile_url  text,
  timezone            text not null default 'Asia/Karachi',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- team_members  (the join that actually grants team access)
-- ----------------------------------------------------------------------------
create table if not exists public.team_members (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  role              public.team_role not null default 'member',
  membership_status public.membership_status not null default 'pending_approval',
  joined_at         timestamptz,
  suspended_at      timestamptz,
  removed_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists team_members_user_idx
  on public.team_members(user_id);
create index if not exists team_members_team_status_idx
  on public.team_members(team_id, membership_status);

-- ----------------------------------------------------------------------------
-- invitations  (admin/leader invite → invitee signs up → pending_approval)
-- ----------------------------------------------------------------------------
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  email       text not null,
  role        public.team_role not null default 'member',
  invited_by  uuid not null references public.profiles(id),
  status      public.invitation_status not null default 'sent',
  expires_at  timestamptz,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists invitations_team_status_idx
  on public.invitations(team_id, status);
create index if not exists invitations_email_idx
  on public.invitations(email);

-- ----------------------------------------------------------------------------
-- Auto-create a profile row when a new auth.user is created (FR-A trigger)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- updated_at auto-maintenance
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

drop trigger if exists invitations_set_updated_at on public.invitations;
create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS helper functions
-- All authorization derives from auth.uid() — never from a client value.
-- ============================================================================

-- The single team at launch. Returns its id.
create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select id from public.teams order by created_at asc limit 1;
$$;

-- Is the caller an active member of a given team?
create or replace function public.is_active_member_of(p_team_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = auth.uid()
      and tm.membership_status = 'active'
  );
$$;

-- Is the caller an active admin of a given team?
create or replace function public.is_team_admin_of(p_team_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = auth.uid()
      and tm.role = 'admin'
      and tm.membership_status = 'active'
  );
$$;

-- Is the caller an active admin or leader of a given team?
create or replace function public.is_team_leader_or_admin_of(p_team_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin','leader')
      and tm.membership_status = 'active'
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.teams        enable row level security;
alter table public.profiles     enable row level security;
alter table public.team_members enable row level security;
alter table public.invitations  enable row level security;

-- ---- teams ---------------------------------------------------------------
drop policy if exists "teams_select" on public.teams;
create policy "teams_select" on public.teams
  for select using (public.is_active_member_of(id));

drop policy if exists "teams_admin_write" on public.teams;
create policy "teams_admin_write" on public.teams
  for all using (public.is_team_admin_of(id))
  with check (public.is_team_admin_of(id));

-- ---- profiles ------------------------------------------------------------
-- A user can always read their own profile.
-- Active team members can read other active members' profiles (team directory).
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.team_members tm
      join public.team_members me
        on me.team_id = tm.team_id
      where tm.user_id = public.profiles.id
        and tm.membership_status = 'active'
        and me.user_id = auth.uid()
        and me.membership_status = 'active'
    )
  );

-- A user may update only their OWN profile, and NEVER the id/email columns
-- (role & membership live in team_members, not here, so they are not at risk
-- from a profile update). Avatar/bio/github/username/full_name/timezone are
-- the editable fields per the permission matrix.
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Inserts happen only via the SECURITY DEFINER trigger — block direct inserts.
drop policy if exists "profiles_no_direct_insert" on public.profiles;
create policy "profiles_no_direct_insert" on public.profiles
  for insert with check (false);

-- ---- team_members --------------------------------------------------------
-- Active members can see the team roster (active + pending_approval only,
-- so they know who is waiting). Suspended/removed rows are admin-only.
drop policy if exists "team_members_select" on public.team_members;
create policy "team_members_select" on public.team_members
  for select using (
    public.is_team_leader_or_admin_of(team_id)
    or (
      public.is_active_member_of(team_id)
      and membership_status in ('active','pending_approval')
    )
  );

-- Only admins can add / change / remove members. Leaders cannot.
-- A member can NEVER insert/update/delete their own membership to escalate.
drop policy if exists "team_members_admin_write" on public.team_members;
create policy "team_members_admin_write" on public.team_members
  for all using (public.is_team_admin_of(team_id))
  with check (public.is_team_admin_of(team_id));

-- ---- invitations ---------------------------------------------------------
-- Admins and leaders can read invitations. Members cannot.
drop policy if exists "invitations_select" on public.invitations;
create policy "invitations_select" on public.invitations
  for select using (public.is_team_leader_or_admin_of(team_id));

-- Admins and leaders can create/invite. Only admins can revoke/delete.
drop policy if exists "invitations_leader_insert" on public.invitations;
create policy "invitations_leader_insert" on public.invitations
  for insert with check (
    public.is_team_leader_or_admin_of(team_id)
    and invited_by = auth.uid()
  );

drop policy if exists "invitations_admin_update" on public.invitations;
create policy "invitations_admin_update" on public.invitations
  for update using (public.is_team_admin_of(team_id))
  with check (public.is_team_admin_of(team_id));

drop policy if exists "invitations_admin_delete" on public.invitations;
create policy "invitations_admin_delete" on public.invitations
  for delete using (public.is_team_admin_of(team_id));

-- ============================================================================
-- Done. Bootstrap the first admin with supabase/seed/bootstrap-admin.sql.
-- ============================================================================
