-- ============================================================================
-- 0002_roadmap.sql — Learning roadmap schema + RLS
-- Adds: team_settings, phases, weeks, topics, learning_resources, topic_progress
-- Backward-compatible: does not touch 0001 tables. Enums already exist in 0001.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- team_settings (deferred from Phase 1 design; current_week now possible)
-- ----------------------------------------------------------------------------
create table if not exists public.team_settings (
  id                         uuid primary key default gen_random_uuid(),
  team_id                    uuid not null unique references public.teams(id) on delete cascade,
  current_week_id            uuid,
  sequential_progression     boolean not null default false,
  weekly_report_deadline_day int not null default 0,  -- 0=Sunday .. 6=Saturday
  timezone                   text not null default 'Asia/Karachi',
  updated_at                 timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- phases
-- ----------------------------------------------------------------------------
create table if not exists public.phases (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  title        text not null,
  slug         text not null,
  description  text,
  phase_number int not null,
  start_week   int not null,
  end_week     int not null,
  status       public.phase_status not null default 'draft',
  display_order int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (team_id, phase_number),
  unique (team_id, slug)
);

create index if not exists phases_team_idx on public.phases(team_id, display_order);

-- ----------------------------------------------------------------------------
-- weeks
-- ----------------------------------------------------------------------------
create table if not exists public.weeks (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  phase_id      uuid not null references public.phases(id) on delete cascade,
  week_number   int not null,
  title         text not null,
  slug          text not null,
  overview      text,
  objectives    jsonb not null default '[]'::jsonb,        -- array of strings
  deliverables  jsonb not null default '[]'::jsonb,
  completion_criteria jsonb not null default '[]'::jsonb,
  start_date    timestamptz,
  end_date      timestamptz,
  status        public.week_status not null default 'draft',
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (team_id, week_number),
  unique (team_id, slug)
);

create index if not exists weeks_phase_idx on public.weeks(phase_id, display_order);

-- Add the current-week foreign key only after weeks exists.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_settings_current_week_id_fkey'
      and conrelid = 'public.team_settings'::regclass
  ) then
    alter table public.team_settings
      add constraint team_settings_current_week_id_fkey
      foreign key (current_week_id) references public.weeks(id) on delete set null;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- topics
-- ----------------------------------------------------------------------------
create table if not exists public.topics (
  id                  uuid primary key default gen_random_uuid(),
  team_id             uuid not null references public.teams(id) on delete cascade,
  week_id             uuid not null references public.weeks(id) on delete cascade,
  title               text not null,
  slug                text not null,
  description         text,
  learning_objectives jsonb not null default '[]'::jsonb,   -- array of strings
  estimated_minutes   int,
  difficulty          public.topic_difficulty not null default 'beginner',
  prerequisites       jsonb not null default '[]'::jsonb,   -- array of strings
  practical_exercise  text,
  completion_criteria jsonb not null default '[]'::jsonb,
  display_order       int not null default 0,
  publication_status  public.publication_status not null default 'published',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (week_id, slug)
);

create index if not exists topics_week_idx on public.topics(week_id, display_order);
create index if not exists topics_team_idx on public.topics(team_id);

-- ----------------------------------------------------------------------------
-- learning_resources
-- ----------------------------------------------------------------------------
create table if not exists public.learning_resources (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  topic_id      uuid references public.topics(id) on delete cascade,
  title         text not null,
  url           text not null,
  resource_type public.resource_type not null default 'documentation',
  description   text,
  difficulty    public.topic_difficulty,
  is_free       boolean not null default true,
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists resources_topic_idx on public.learning_resources(topic_id, display_order);

-- ----------------------------------------------------------------------------
-- topic_progress  (per-user; completion is a deliberate action, never auto)
-- ----------------------------------------------------------------------------
create table if not exists public.topic_progress (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references public.topics(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       public.topic_status not null default 'available',
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (topic_id, user_id)
);

create index if not exists topic_progress_user_idx on public.topic_progress(user_id);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
drop trigger if exists team_settings_set_updated_at on public.team_settings;
create trigger team_settings_set_updated_at
  before update on public.team_settings
  for each row execute function public.set_updated_at();

drop trigger if exists phases_set_updated_at on public.phases;
create trigger phases_set_updated_at
  before update on public.phases
  for each row execute function public.set_updated_at();

drop trigger if exists weeks_set_updated_at on public.weeks;
create trigger weeks_set_updated_at
  before update on public.weeks
  for each row execute function public.set_updated_at();

drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

drop trigger if exists learning_resources_set_updated_at on public.learning_resources;
create trigger learning_resources_set_updated_at
  before update on public.learning_resources
  for each row execute function public.set_updated_at();

drop trigger if exists topic_progress_set_updated_at on public.topic_progress;
create trigger topic_progress_set_updated_at
  before update on public.topic_progress
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.team_settings      enable row level security;
alter table public.phases             enable row level security;
alter table public.weeks              enable row level security;
alter table public.topics             enable row level security;
alter table public.learning_resources enable row level security;
alter table public.topic_progress     enable row level security;

-- ---- team_settings ----
drop policy if exists "team_settings_select" on public.team_settings;
create policy "team_settings_select" on public.team_settings
  for select using (public.is_active_member_of(team_id));

drop policy if exists "team_settings_admin_update" on public.team_settings;
create policy "team_settings_admin_update" on public.team_settings
  for update using (public.is_team_admin_of(team_id))
  with check (
    public.is_team_admin_of(team_id)
    and (
      current_week_id is null
      or exists (
        select 1 from public.weeks w
        where w.id = team_settings.current_week_id
          and w.team_id = team_settings.team_id
      )
    )
  );

-- ---- phases ----
-- Published phases visible to active members; leaders/admins see all.
drop policy if exists "phases_select" on public.phases;
create policy "phases_select" on public.phases
  for select using (
    public.is_active_member_of(team_id)
    and (status = 'published' or public.is_team_leader_or_admin_of(team_id))
  );

drop policy if exists "phases_leader_write" on public.phases;
create policy "phases_leader_write" on public.phases
  for all using (public.is_team_leader_or_admin_of(team_id))
  with check (public.is_team_leader_or_admin_of(team_id));

-- ---- weeks ----
drop policy if exists "weeks_select" on public.weeks;
create policy "weeks_select" on public.weeks
  for select using (
    public.is_active_member_of(team_id)
    and (status = 'published' or public.is_team_leader_or_admin_of(team_id))
  );

drop policy if exists "weeks_leader_write" on public.weeks;
create policy "weeks_leader_write" on public.weeks
  for all using (public.is_team_leader_or_admin_of(team_id))
  with check (
    public.is_team_leader_or_admin_of(team_id)
    and exists (
      select 1 from public.phases p
      where p.id = weeks.phase_id and p.team_id = weeks.team_id
    )
  );

-- ---- topics ----
drop policy if exists "topics_select" on public.topics;
create policy "topics_select" on public.topics
  for select using (
    public.is_active_member_of(team_id)
    and (publication_status = 'published' or public.is_team_leader_or_admin_of(team_id))
  );

drop policy if exists "topics_leader_write" on public.topics;
create policy "topics_leader_write" on public.topics
  for all using (public.is_team_leader_or_admin_of(team_id))
  with check (
    public.is_team_leader_or_admin_of(team_id)
    and exists (
      select 1 from public.weeks w
      where w.id = topics.week_id and w.team_id = topics.team_id
    )
  );

-- ---- learning_resources ----
-- Visible to active members when the topic is published (or leader/admin).
drop policy if exists "learning_resources_select" on public.learning_resources;
create policy "learning_resources_select" on public.learning_resources
  for select using (
    public.is_active_member_of(team_id)
    and (
      public.is_team_leader_or_admin_of(team_id)
      or exists (
        select 1 from public.topics t
        where t.id = public.learning_resources.topic_id
          and t.team_id = public.learning_resources.team_id
          and t.publication_status = 'published'
      )
    )
  );

drop policy if exists "learning_resources_leader_write" on public.learning_resources;
create policy "learning_resources_leader_write" on public.learning_resources
  for all using (public.is_team_leader_or_admin_of(team_id))
  with check (
    public.is_team_leader_or_admin_of(team_id)
    and (
      topic_id is null
      or exists (
        select 1 from public.topics t
        where t.id = learning_resources.topic_id
          and t.team_id = learning_resources.team_id
      )
    )
  );

-- ---- topic_progress ----
-- A user reads/updates their own; leaders/admins read all team progress.
drop policy if exists "topic_progress_select" on public.topic_progress;
create policy "topic_progress_select" on public.topic_progress
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.topics t
      join public.team_members tm on tm.team_id = t.team_id
      where t.id = public.topic_progress.topic_id
        and tm.user_id = auth.uid()
        and tm.role in ('admin','leader')
        and tm.membership_status = 'active'
    )
  );

drop policy if exists "topic_progress_self_upsert" on public.topic_progress;
create policy "topic_progress_self_upsert" on public.topic_progress
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.topics t
      where t.id = topic_progress.topic_id
        and t.publication_status = 'published'
        and public.is_active_member_of(t.team_id)
    )
  );

drop policy if exists "topic_progress_self_update" on public.topic_progress;
create policy "topic_progress_self_update" on public.topic_progress
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.topics t
      where t.id = topic_progress.topic_id
        and t.publication_status = 'published'
        and public.is_active_member_of(t.team_id)
    )
  );

drop policy if exists "topic_progress_self_delete" on public.topic_progress;
create policy "topic_progress_self_delete" on public.topic_progress
  for delete using (
    user_id = auth.uid()
    and exists (
      select 1 from public.topics t
      where t.id = topic_progress.topic_id
        and public.is_active_member_of(t.team_id)
    )
  );

-- ============================================================================
-- Done.
-- ============================================================================
