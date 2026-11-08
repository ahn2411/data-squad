-- ============================================================================
-- 0003_assignments.sql — Assignments, submissions, reviews + RLS
-- Adds: assignments, assignment_recipients, submissions, submission_files,
--       submission_revisions, reviews
-- Enums already exist in 0001.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- assignments
-- ----------------------------------------------------------------------------
create table if not exists public.assignments (
  id                       uuid primary key default gen_random_uuid(),
  team_id                  uuid not null references public.teams(id) on delete cascade,
  title                    text not null,
  description              text,
  instructions             text,
  phase_id                 uuid references public.phases(id) on delete set null,
  week_id                  uuid references public.weeks(id) on delete set null,
  topic_id                 uuid references public.topics(id) on delete set null,
  assignment_type          public.assignment_type not null default 'programming_exercise',
  difficulty               public.assignment_difficulty not null default 'beginner',
  max_score                int,
  required_submission_type public.submission_type,
  supporting_resources     jsonb not null default '[]'::jsonb,  -- array of URL strings
  deliverables             jsonb not null default '[]'::jsonb,
  evaluation_criteria      jsonb not null default '[]'::jsonb,
  publication_status       public.publication_status not null default 'draft',
  published_at             timestamptz,
  deadline                 timestamptz,
  created_by               uuid not null references public.profiles(id),
  display_order            int not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists assignments_team_idx on public.assignments(team_id, display_order);
create index if not exists assignments_week_idx on public.assignments(week_id);
create index if not exists assignments_status_idx on public.assignments(team_id, publication_status);

-- ----------------------------------------------------------------------------
-- assignment_recipients  (empty = assigned to whole team)
-- ----------------------------------------------------------------------------
create table if not exists public.assignment_recipients (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create index if not exists recipients_assignment_idx on public.assignment_recipients(assignment_id);
create index if not exists recipients_user_idx on public.assignment_recipients(user_id);

-- A SECURITY DEFINER helper avoids recipient-row RLS hiding other recipients
-- from the team-wide assignment check below. It only returns whether the
-- current authenticated user may access the assignment.
create or replace function public.can_access_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = p_assignment_id
      and (
        public.is_team_leader_or_admin_of(a.team_id)
        or (
          public.is_active_member_of(a.team_id)
          and a.publication_status = 'published'
          and (
            not exists (
              select 1 from public.assignment_recipients r
              where r.assignment_id = a.id
            )
            or exists (
              select 1 from public.assignment_recipients r
              where r.assignment_id = a.id and r.user_id = auth.uid()
            )
          )
        )
      )
  );
$$;
revoke all on function public.can_access_assignment(uuid) from public, anon;
grant execute on function public.can_access_assignment(uuid) to authenticated;

create or replace function public.can_submit_to_assignment(
  p_assignment_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = p_assignment_id
      and a.team_id = p_team_id
      and a.publication_status = 'published'
      and public.is_active_member_of(p_team_id)
      and (
        not exists (
          select 1 from public.assignment_recipients r
          where r.assignment_id = a.id
        )
        or exists (
          select 1 from public.assignment_recipients r
          where r.assignment_id = a.id and r.user_id = auth.uid()
        )
      )
  );
$$;
revoke all on function public.can_submit_to_assignment(uuid, uuid) from public, anon;
grant execute on function public.can_submit_to_assignment(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- submissions  (one per user per assignment)
-- ----------------------------------------------------------------------------
create table if not exists public.submissions (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references public.assignments(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete cascade,
  status          public.submission_status not null default 'not_started',
  submission_text text,
  submission_url  text,
  is_late         boolean not null default false,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create index if not exists submissions_user_idx on public.submissions(user_id);
create index if not exists submissions_status_idx on public.submissions(team_id, status);

-- ----------------------------------------------------------------------------
-- submission_revisions  (immutable append-only history; D3)
-- ----------------------------------------------------------------------------
create table if not exists public.submission_revisions (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.submissions(id) on delete cascade,
  revision_number int not null,
  submission_text text,
  submission_url  text,
  submitted_by    uuid not null references public.profiles(id),
  submitted_at    timestamptz not null default now(),
  is_late         boolean not null default false
);

create index if not exists revisions_submission_idx on public.submission_revisions(submission_id, revision_number);
create unique index if not exists revisions_submission_number_uq
  on public.submission_revisions(submission_id, revision_number);

-- ----------------------------------------------------------------------------
-- submission_files  (metadata; bytes live in Supabase Storage)
-- ----------------------------------------------------------------------------
create table if not exists public.submission_files (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  storage_path  text not null,       -- bucket/object path
  file_name     text not null,
  content_type  text,
  file_size     bigint,
  uploaded_by   uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);

create index if not exists files_submission_idx on public.submission_files(submission_id);

-- ----------------------------------------------------------------------------
-- reviews
-- ----------------------------------------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reviewer_id   uuid not null references public.profiles(id),
  revision_id   uuid references public.submission_revisions(id) on delete set null,
  review_status public.review_status not null default 'pending',
  score         int,
  feedback      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists reviews_submission_idx on public.reviews(submission_id);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
drop trigger if exists assignments_set_updated_at on public.assignments;
create trigger assignments_set_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- is_late: flag submissions submitted after the assignment deadline (FR-AS.10)
-- ----------------------------------------------------------------------------
create or replace function public.flag_late_submission()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_deadline timestamptz;
begin
  select a.deadline into v_deadline from public.assignments a where a.id = new.assignment_id;
  if TG_OP = 'INSERT' then
    if new.status = 'submitted' then
      new.submitted_at := now();
    end if;
  elsif new.status = 'submitted' and old.status is distinct from 'submitted' then
    new.submitted_at := now();
  end if;
  new.is_late := v_deadline is not null
    and new.submitted_at is not null
    and new.submitted_at > v_deadline;
  return new;
end;
$$;

drop trigger if exists submissions_flag_late on public.submissions;
create trigger submissions_flag_late
  before insert or update of submitted_at, status on public.submissions
  for each row execute function public.flag_late_submission();

create or replace function public.flag_late_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deadline timestamptz;
begin
  select a.deadline into v_deadline
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = new.submission_id;
  new.is_late := v_deadline is not null and new.submitted_at > v_deadline;
  return new;
end;
$$;
revoke all on function public.flag_late_revision() from public, anon, authenticated;
drop trigger if exists submission_revisions_flag_late on public.submission_revisions;
create trigger submission_revisions_flag_late
  before insert on public.submission_revisions
  for each row execute function public.flag_late_revision();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.assignments            enable row level security;
alter table public.assignment_recipients  enable row level security;
alter table public.submissions            enable row level security;
alter table public.submission_revisions   enable row level security;
alter table public.submission_files       enable row level security;
alter table public.reviews                enable row level security;

-- ---- assignments ----
-- Members see published assignments assigned to them (or team-wide).
-- Leaders/admins see all (incl. drafts).
drop policy if exists "assignments_select" on public.assignments;
create policy "assignments_select" on public.assignments
  for select using (
    public.is_team_leader_or_admin_of(team_id)
    or public.can_access_assignment(id)
  );

drop policy if exists "assignments_leader_write" on public.assignments;
create policy "assignments_leader_write" on public.assignments
  for all using (public.is_team_leader_or_admin_of(team_id))
  with check (
    public.is_team_leader_or_admin_of(team_id)
    and (
      phase_id is null
      or exists (select 1 from public.phases p where p.id = assignments.phase_id and p.team_id = assignments.team_id)
    )
    and (
      week_id is null
      or exists (select 1 from public.weeks w where w.id = assignments.week_id and w.team_id = assignments.team_id)
    )
    and (
      topic_id is null
      or exists (select 1 from public.topics t where t.id = assignments.topic_id and t.team_id = assignments.team_id)
    )
  );

-- ---- assignment_recipients ----
drop policy if exists "recipients_select" on public.assignment_recipients;
create policy "recipients_select" on public.assignment_recipients
  for select using (
    user_id = auth.uid()
    or public.is_team_leader_or_admin_of(
      (select team_id from public.assignments a where a.id = assignment_id)
    )
  );

drop policy if exists "recipients_leader_write" on public.assignment_recipients;
create policy "recipients_leader_write" on public.assignment_recipients
  for all using (public.is_team_leader_or_admin_of(
    (select team_id from public.assignments a where a.id = assignment_id)
  ))
  with check (
    public.is_team_leader_or_admin_of(
      (select team_id from public.assignments a where a.id = assignment_id)
    )
    and exists (
      select 1 from public.assignments a
      join public.team_members tm on tm.team_id = a.team_id
      where a.id = assignment_recipients.assignment_id
        and tm.user_id = assignment_recipients.user_id
        and tm.membership_status = 'active'
    )
  );

-- ---- submissions ----
-- Own submissions: full read + create + update (within allowed statuses).
-- Leaders/admins: read all team submissions (for review). They do NOT update
-- the submission row itself — they add a review instead.
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (
    user_id = auth.uid()
    or public.is_team_leader_or_admin_of(team_id)
  );

drop policy if exists "submissions_self_insert" on public.submissions;
create policy "submissions_self_insert" on public.submissions
  for insert with check (
    user_id = auth.uid()
    and public.is_active_member_of(team_id)
    and public.can_submit_to_assignment(assignment_id, team_id)
    and status in ('in_progress', 'submitted')
  );

drop policy if exists "submissions_self_update" on public.submissions;
create policy "submissions_self_update" on public.submissions
  for update using (
    user_id = auth.uid()
    and public.is_active_member_of(team_id)
    and status in ('not_started','in_progress','revision_requested')
  ) with check (
    user_id = auth.uid()
    and public.is_active_member_of(team_id)
    and public.can_submit_to_assignment(assignment_id, team_id)
    and status in ('in_progress','submitted','revision_requested')
  );

create or replace function public.prevent_submission_identity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.team_id is distinct from old.team_id
    or new.assignment_id is distinct from old.assignment_id then
    raise exception 'submission_identity_immutable';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_submission_identity_change() from public, anon, authenticated;
drop trigger if exists submissions_identity_immutable on public.submissions;
create trigger submissions_identity_immutable
  before update on public.submissions
  for each row execute function public.prevent_submission_identity_change();

drop policy if exists "submissions_self_delete" on public.submissions;
create policy "submissions_self_delete" on public.submissions
  for delete using (
    user_id = auth.uid()
    and status in ('not_started','in_progress','revision_requested')
  );

-- ---- submission_revisions ----
drop policy if exists "revisions_select" on public.submission_revisions;
create policy "revisions_select" on public.submission_revisions
  for select using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and (s.user_id = auth.uid()
             or public.is_team_leader_or_admin_of(s.team_id))
    )
  );

drop policy if exists "revisions_self_insert" on public.submission_revisions;
create policy "revisions_self_insert" on public.submission_revisions
  for insert with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and s.user_id = auth.uid()
        and s.status in ('submitted','revision_requested')
    )
  );

-- ---- submission_files ----
drop policy if exists "submission_files_select" on public.submission_files;
create policy "submission_files_select" on public.submission_files
  for select using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and (s.user_id = auth.uid()
             or public.is_team_leader_or_admin_of(s.team_id))
    )
  );

drop policy if exists "submission_files_self_insert" on public.submission_files;
create policy "submission_files_self_insert" on public.submission_files
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and s.user_id = auth.uid()
        and s.status in ('not_started','in_progress','revision_requested')
    )
  );

drop policy if exists "submission_files_self_delete" on public.submission_files;
create policy "submission_files_self_delete" on public.submission_files
  for delete using (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.user_id = auth.uid()
        and s.status in ('not_started','in_progress','revision_requested')
    )
  );

-- ---- reviews ----
-- Leaders/admins create & manage reviews. Members read reviews on their own
-- submissions. Nobody can review their own work (enforced in the action +
-- database trigger below).
drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select" on public.reviews
  for select using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and (s.user_id = auth.uid()
             or public.is_team_leader_or_admin_of(s.team_id))
    )
  );

drop policy if exists "reviews_leader_write" on public.reviews;
create policy "reviews_leader_write" on public.reviews
  for all using (
    public.is_team_leader_or_admin_of(
      (select team_id from public.submissions s where s.id = submission_id)
    )
  )
  with check (
    public.is_team_leader_or_admin_of(
      (select team_id from public.submissions s where s.id = submission_id)
    )
    and reviewer_id = auth.uid()
  );

-- A CHECK constraint cannot contain a subquery, so enforce non-self-review in
-- a narrowly scoped trigger instead.
create or replace function public.prevent_self_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.submissions s
    where s.id = new.submission_id and s.user_id = new.reviewer_id
  ) then
    raise exception 'reviews_not_self';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_self_review() from public, anon, authenticated;
drop trigger if exists reviews_prevent_self on public.reviews;
create trigger reviews_prevent_self
  before insert or update of submission_id, reviewer_id on public.reviews
  for each row execute function public.prevent_self_review();

-- Review outcomes update submission status inside the database. Leaders do not
-- get broad UPDATE access to a member's submission row.
create or replace function public.apply_review_to_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.submissions
  set status = case new.review_status
    when 'approved' then 'approved'::public.submission_status
    when 'revision_requested' then 'revision_requested'::public.submission_status
    when 'rejected' then 'rejected'::public.submission_status
    else 'under_review'::public.submission_status
  end
  where id = new.submission_id;
  return new;
end;
$$;
revoke all on function public.apply_review_to_submission() from public, anon, authenticated;
drop trigger if exists reviews_apply_submission_status on public.reviews;
create trigger reviews_apply_submission_status
  after insert on public.reviews
  for each row execute function public.apply_review_to_submission();

-- ============================================================================
-- Done.
-- ============================================================================
