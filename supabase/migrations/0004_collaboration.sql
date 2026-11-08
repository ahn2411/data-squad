-- ============================================================================
-- 0004_collaboration.sql — Reports, discussions, blockers, announcements,
-- notifications, activity logs + RLS + notification triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- weekly_reports  (one per user per week)
-- ----------------------------------------------------------------------------
create table if not exists public.weekly_reports (
  id                   uuid primary key default gen_random_uuid(),
  team_id              uuid not null references public.teams(id) on delete cascade,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  week_id              uuid not null references public.weeks(id) on delete cascade,
  learned              text,
  topics_completed     jsonb not null default '[]'::jsonb,
  exercises_completed  jsonb not null default '[]'::jsonb,
  assignments_completed jsonb not null default '[]'::jsonb,
  hours_spent          numeric(5,1) not null default 0,
  biggest_achievement  text,
  main_difficulty      text,
  current_blockers     text,
  questions            text,
  next_week_goals      text,
  github_links         jsonb not null default '[]'::jsonb,
  leader_feedback      text,
  submitted_at         timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, week_id)
);

create index if not exists reports_team_week_idx on public.weekly_reports(team_id, week_id);

-- ----------------------------------------------------------------------------
-- discussion_threads
-- ----------------------------------------------------------------------------
create table if not exists public.discussion_threads (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  title       text not null,
  category    text not null default 'General',
  created_by  uuid not null references public.profiles(id),
  pinned_at   timestamptz,
  locked_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists threads_team_idx on public.discussion_threads(team_id, created_at desc);

-- ----------------------------------------------------------------------------
-- discussion_posts
-- ----------------------------------------------------------------------------
create table if not exists public.discussion_posts (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.discussion_threads(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  parent_post_id  uuid references public.discussion_posts(id) on delete cascade,
  body            text not null,
  is_answer       boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists posts_thread_idx on public.discussion_posts(thread_id, created_at);

-- ----------------------------------------------------------------------------
-- blockers
-- ----------------------------------------------------------------------------
create table if not exists public.blockers (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  description      text,
  topic_id         uuid references public.topics(id) on delete set null,
  assignment_id    uuid references public.assignments(id) on delete set null,
  error_messages   text,
  code_url         text,
  priority         public.blocker_priority not null default 'medium',
  status           public.blocker_status not null default 'open',
  assigned_helper  uuid references public.profiles(id) on delete set null,
  resolution_notes text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists blockers_team_status_idx on public.blockers(team_id, status);

-- ----------------------------------------------------------------------------
-- blocker_comments
-- ----------------------------------------------------------------------------
create table if not exists public.blocker_comments (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references public.blockers(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists blocker_comments_blocker_idx on public.blocker_comments(blocker_id, created_at);

-- ----------------------------------------------------------------------------
-- announcements
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  title        text not null,
  content      text,
  author_id    uuid not null references public.profiles(id),
  pinned       boolean not null default false,
  status       public.publication_status not null default 'published',
  published_at timestamptz,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists announcements_team_idx on public.announcements(team_id, published_at desc);

-- ----------------------------------------------------------------------------
-- notifications  (inserted ONLY by SECURITY DEFINER triggers; never by clients)
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  body        text,
  entity_type text,
  entity_id   uuid,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, read_at);

-- ----------------------------------------------------------------------------
-- activity_logs  (system-only; audit trail)
-- ----------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_team_idx on public.activity_logs(team_id, created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'weekly_reports','discussion_threads','discussion_posts',
    'blockers','blocker_comments','announcements'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I;', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.weekly_reports      enable row level security;
alter table public.discussion_threads  enable row level security;
alter table public.discussion_posts    enable row level security;
alter table public.blockers            enable row level security;
alter table public.blocker_comments    enable row level security;
alter table public.announcements       enable row level security;
alter table public.notifications       enable row level security;
alter table public.activity_logs       enable row level security;

-- ---- weekly_reports ----
drop policy if exists "reports_select" on public.weekly_reports;
create policy "reports_select" on public.weekly_reports
  for select using (
    user_id = auth.uid() or public.is_team_leader_or_admin_of(team_id)
  );

drop policy if exists "reports_self_insert" on public.weekly_reports;
create policy "reports_self_insert" on public.weekly_reports
  for insert with check (
    user_id = auth.uid()
    and public.is_active_member_of(team_id)
    and exists (
      select 1 from public.weeks w
      where w.id = weekly_reports.week_id
        and w.team_id = weekly_reports.team_id
    )
  );

drop policy if exists "reports_update" on public.weekly_reports;
create policy "reports_update" on public.weekly_reports
  for update using (
    (user_id = auth.uid() and public.is_active_member_of(team_id))
    or public.is_team_leader_or_admin_of(team_id)
  )
  with check (
    (user_id = auth.uid() and public.is_active_member_of(team_id))
    or public.is_team_leader_or_admin_of(team_id)
  );

create or replace function public.guard_weekly_report_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.team_id is distinct from old.team_id
    or new.week_id is distinct from old.week_id
    or new.created_at is distinct from old.created_at then
    raise exception 'weekly_report_identity_immutable';
  end if;

  if auth.uid() = old.user_id then
    if new.leader_feedback is distinct from old.leader_feedback then
      raise exception 'weekly_report_feedback_leader_only';
    end if;
  elsif public.is_team_leader_or_admin_of(old.team_id) then
    if (to_jsonb(new) - 'leader_feedback' - 'updated_at')
      is distinct from (to_jsonb(old) - 'leader_feedback' - 'updated_at') then
      raise exception 'weekly_report_content_member_only';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_weekly_report_update() from public, anon, authenticated;
drop trigger if exists weekly_reports_guard_update on public.weekly_reports;
create trigger weekly_reports_guard_update
  before update on public.weekly_reports
  for each row execute function public.guard_weekly_report_update();

drop policy if exists "reports_self_delete" on public.weekly_reports;
create policy "reports_self_delete" on public.weekly_reports
  for delete using (user_id = auth.uid());

-- ---- discussion_threads ----
drop policy if exists "threads_select" on public.discussion_threads;
create policy "threads_select" on public.discussion_threads
  for select using (public.is_active_member_of(team_id));

drop policy if exists "threads_member_insert" on public.discussion_threads;
create policy "threads_member_insert" on public.discussion_threads
  for insert with check (
    public.is_active_member_of(team_id) and created_by = auth.uid()
  );

drop policy if exists "threads_update" on public.discussion_threads;
create policy "threads_update" on public.discussion_threads
  for update using (
    (created_by = auth.uid() and public.is_active_member_of(team_id))
    or public.is_team_leader_or_admin_of(team_id)
  )
  with check (
    public.is_active_member_of(team_id)
    and (created_by = auth.uid() or public.is_team_leader_or_admin_of(team_id))
  );

create or replace function public.prevent_thread_reparent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.team_id is distinct from old.team_id
    or new.created_by is distinct from old.created_by then
    raise exception 'discussion_thread_identity_immutable';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_thread_reparent() from public, anon, authenticated;
drop trigger if exists discussion_threads_identity_immutable on public.discussion_threads;
create trigger discussion_threads_identity_immutable
  before update on public.discussion_threads
  for each row execute function public.prevent_thread_reparent();

drop policy if exists "threads_delete" on public.discussion_threads;
create policy "threads_delete" on public.discussion_threads
  for delete using (
    (created_by = auth.uid() and public.is_active_member_of(team_id))
    or public.is_team_leader_or_admin_of(team_id)
  );

-- ---- discussion_posts ----
drop policy if exists "posts_select" on public.discussion_posts;
create policy "posts_select" on public.discussion_posts
  for select using (
    exists (
      select 1 from public.discussion_threads th
      where th.id = thread_id
        and public.is_active_member_of(th.team_id)
        and (
          deleted_at is null
          or author_id = auth.uid()
          or public.is_team_leader_or_admin_of(th.team_id)
        )
    )
  );

drop policy if exists "posts_member_insert" on public.discussion_posts;
create policy "posts_member_insert" on public.discussion_posts
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.discussion_threads th
      where th.id = thread_id
        and public.is_active_member_of(th.team_id)
        and (
          th.locked_at is null
          or public.is_team_leader_or_admin_of(th.team_id)
        )
        and (
          parent_post_id is null
          or exists (
            select 1 from public.discussion_posts parent
            where parent.id = discussion_posts.parent_post_id
              and parent.thread_id = discussion_posts.thread_id
              and parent.deleted_at is null
          )
        )
    )
  );

drop policy if exists "posts_update" on public.discussion_posts;
create policy "posts_update" on public.discussion_posts
  for update using (
    exists (
      select 1 from public.discussion_threads th
      where th.id = thread_id
        and public.is_active_member_of(th.team_id)
        and (th.locked_at is null or public.is_team_leader_or_admin_of(th.team_id))
        and (author_id = auth.uid() or public.is_team_leader_or_admin_of(th.team_id))
    )
  )
  with check (
    exists (
      select 1 from public.discussion_threads th
      where th.id = thread_id
        and public.is_active_member_of(th.team_id)
        and (th.locked_at is null or public.is_team_leader_or_admin_of(th.team_id))
        and (author_id = auth.uid() or public.is_team_leader_or_admin_of(th.team_id))
    )
  );

create or replace function public.prevent_discussion_post_reparent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.thread_id is distinct from old.thread_id
    or new.author_id is distinct from old.author_id
    or new.parent_post_id is distinct from old.parent_post_id then
    raise exception 'discussion_post_identity_immutable';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_discussion_post_reparent() from public, anon, authenticated;
drop trigger if exists discussion_posts_identity_immutable on public.discussion_posts;
create trigger discussion_posts_identity_immutable
  before update on public.discussion_posts
  for each row execute function public.prevent_discussion_post_reparent();

-- Posts are soft-deleted through deleted_at; clients cannot hard-delete them.
drop policy if exists "posts_delete" on public.discussion_posts;

-- ---- blockers ----
drop policy if exists "blockers_select" on public.blockers;
create policy "blockers_select" on public.blockers
  for select using (
    public.is_active_member_of(team_id)
  );

drop policy if exists "blockers_self_insert" on public.blockers;
create policy "blockers_self_insert" on public.blockers
  for insert with check (
    user_id = auth.uid()
    and public.is_active_member_of(team_id)
    and (
      topic_id is null
      or exists (
        select 1 from public.topics t
        where t.id = blockers.topic_id and t.team_id = blockers.team_id
      )
    )
    and (
      assignment_id is null
      or exists (
        select 1 from public.assignments a
        where a.id = blockers.assignment_id and a.team_id = blockers.team_id
      )
    )
  );

drop policy if exists "blockers_update" on public.blockers;
create policy "blockers_update" on public.blockers
  for update using (
    (user_id = auth.uid() and public.is_active_member_of(team_id))
    or public.is_team_leader_or_admin_of(team_id)
  )
  with check (
    public.is_active_member_of(team_id)
    and (
      (user_id = auth.uid() and public.is_active_member_of(team_id))
      or public.is_team_leader_or_admin_of(team_id)
    )
    and (
      topic_id is null
      or exists (
        select 1 from public.topics t
        where t.id = blockers.topic_id and t.team_id = blockers.team_id
      )
    )
    and (
      assignment_id is null
      or exists (
        select 1 from public.assignments a
        where a.id = blockers.assignment_id and a.team_id = blockers.team_id
      )
    )
    and (
      assigned_helper is null
      or exists (
        select 1 from public.team_members tm
        where tm.user_id = blockers.assigned_helper
          and tm.team_id = blockers.team_id
          and tm.membership_status = 'active'
      )
    )
  );

create or replace function public.guard_blocker_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.team_id is distinct from old.team_id
    or new.user_id is distinct from old.user_id then
    raise exception 'blocker_identity_immutable';
  end if;
  if auth.uid() = old.user_id
    and not public.is_team_leader_or_admin_of(old.team_id)
    and (
      new.status is distinct from old.status
      or new.assigned_helper is distinct from old.assigned_helper
      or new.resolution_notes is distinct from old.resolution_notes
    ) then
    raise exception 'blocker_status_leader_only';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_blocker_update() from public, anon, authenticated;
drop trigger if exists blockers_guard_update on public.blockers;
create trigger blockers_guard_update
  before update on public.blockers
  for each row execute function public.guard_blocker_update();

drop policy if exists "blockers_self_delete" on public.blockers;
create policy "blockers_self_delete" on public.blockers
  for delete using (user_id = auth.uid());

-- ---- blocker_comments ----
drop policy if exists "blocker_comments_select" on public.blocker_comments;
create policy "blocker_comments_select" on public.blocker_comments
  for select using (
    exists (
      select 1 from public.blockers b
      where b.id = blocker_id
        and public.is_active_member_of(b.team_id)
    )
  );

drop policy if exists "blocker_comments_insert" on public.blocker_comments;
create policy "blocker_comments_insert" on public.blocker_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.blockers b
      where b.id = blocker_id and public.is_active_member_of(b.team_id)
    )
  );

drop policy if exists "blocker_comments_update" on public.blocker_comments;
create policy "blocker_comments_update" on public.blocker_comments
  for update using (
    author_id = auth.uid()
    and exists (
      select 1 from public.blockers b
      where b.id = blocker_id and public.is_active_member_of(b.team_id)
    )
  ) with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.blockers b
      where b.id = blocker_id and public.is_active_member_of(b.team_id)
    )
  );

drop policy if exists "blocker_comments_delete" on public.blocker_comments;
create policy "blocker_comments_delete" on public.blocker_comments
  for delete using (
    author_id = auth.uid()
    and exists (
      select 1 from public.blockers b
      where b.id = blocker_comments.blocker_id
        and public.is_active_member_of(b.team_id)
    )
  );

create or replace function public.prevent_blocker_comment_reparent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.blocker_id is distinct from old.blocker_id
    or new.author_id is distinct from old.author_id then
    raise exception 'blocker_comment_identity_immutable';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_blocker_comment_reparent() from public, anon, authenticated;
drop trigger if exists blocker_comments_identity_immutable on public.blocker_comments;
create trigger blocker_comments_identity_immutable
  before update on public.blocker_comments
  for each row execute function public.prevent_blocker_comment_reparent();

-- ---- announcements ----
drop policy if exists "announcements_select" on public.announcements;
create policy "announcements_select" on public.announcements
  for select using (
    public.is_team_leader_or_admin_of(team_id)
    or (public.is_active_member_of(team_id) and status = 'published')
  );

drop policy if exists "announcements_leader_write" on public.announcements;
create policy "announcements_leader_write" on public.announcements
  for all using (public.is_team_leader_or_admin_of(team_id))
  with check (public.is_team_leader_or_admin_of(team_id));

-- ---- notifications ----
-- Select & mark-read: own only. Insert/delete: blocked for clients (triggers only).
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications
  for delete using (user_id = auth.uid());

-- No insert policy → RLS blocks all direct client inserts.

-- ---- activity_logs ----
drop policy if exists "activity_logs_select" on public.activity_logs;
create policy "activity_logs_select" on public.activity_logs
  for select using (public.is_team_leader_or_admin_of(team_id));
-- No insert/update/delete policy → system-only (triggers).

-- ============================================================================
-- Notification triggers (SECURITY DEFINER — bypass RLS to insert rows)
-- ============================================================================

-- Helper: insert a single notification (used by the triggers below).
create or replace function public.create_notification(
  p_user_id  uuid,
  p_team_id  uuid,
  p_type     public.notification_type,
  p_title    text,
  p_body     text default null,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_link        text default null
) returns void
language sql
security definer set search_path = public
as $$
  insert into public.notifications (user_id, team_id, type, title, body, entity_type, entity_id, link)
  values (p_user_id, p_team_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_link);
$$;
revoke all on function public.create_notification(
  uuid, uuid, public.notification_type, text, text, text, uuid, text
) from public, anon, authenticated;

-- 1. On review insert → notify the submission owner.
create or replace function public.notify_on_review()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_submitter uuid;
  v_team_id   uuid;
  v_subj      text;
  v_type      public.notification_type;
begin
  select s.user_id, s.team_id into v_submitter, v_team_id
  from public.submissions s where s.id = new.submission_id;

  if new.review_status = 'approved' then
    v_type := 'submission_reviewed';
    v_subj := 'Your submission was approved';
  elsif new.review_status = 'revision_requested' then
    v_type := 'revision_requested';
    v_subj := 'Revision requested on your submission';
  elsif new.review_status = 'rejected' then
    v_type := 'submission_reviewed';
    v_subj := 'Your submission was rejected';
  else
    return new;
  end if;

  perform public.create_notification(
    v_submitter, v_team_id, v_type, v_subj, left(coalesce(new.feedback,''),240),
    'submission', new.submission_id, '/submissions/' || new.submission_id::text
  );
  return new;
end;
$$;

drop trigger if exists reviews_notify on public.reviews;
create trigger reviews_notify
  after insert on public.reviews
  for each row execute function public.notify_on_review();

-- 2. On announcement published → notify all active team members.
create or replace function public.notify_on_announcement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  m record;
begin
  if new.status <> 'published' then return new; end if;
  if TG_OP = 'UPDATE' and old.status = 'published' then return new; end if;

  for m in
    select tm.user_id from public.team_members tm
    where tm.team_id = new.team_id and tm.membership_status = 'active'
  loop
    perform public.create_notification(
      m.user_id, new.team_id, 'new_announcement',
      'New announcement: ' || new.title, left(coalesce(new.content,''),240),
      'announcement', new.id, '/announcements'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists announcements_notify on public.announcements;
create trigger announcements_notify
  after insert or update on public.announcements
  for each row execute function public.notify_on_announcement();

-- 3. On assignment published → notify recipients (or all active members if team-wide).
create or replace function public.notify_on_assignment_publish()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  m record;
begin
  if new.publication_status <> 'published' then return new; end if;
  if TG_OP = 'UPDATE' and old.publication_status = 'published' then return new; end if;

  if exists (select 1 from public.assignment_recipients r where r.assignment_id = new.id) then
    for m in
      select r.user_id from public.assignment_recipients r where r.assignment_id = new.id
    loop
      perform public.create_notification(
        m.user_id, new.team_id, 'new_assignment',
        'New assignment: ' || new.title, left(coalesce(new.description,''),240),
        'assignment', new.id, '/assignments/' || new.id::text
      );
    end loop;
  else
    for m in
      select tm.user_id from public.team_members tm
      where tm.team_id = new.team_id and tm.membership_status = 'active'
    loop
      perform public.create_notification(
        m.user_id, new.team_id, 'new_assignment',
        'New assignment: ' || new.title, left(coalesce(new.description,''),240),
        'assignment', new.id, '/assignments/' || new.id::text
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists assignments_notify on public.assignments;
create trigger assignments_notify
  after insert or update on public.assignments
  for each row execute function public.notify_on_assignment_publish();

-- ============================================================================
-- Done.
-- ============================================================================
