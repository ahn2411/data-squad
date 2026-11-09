-- Submission receipt -> notify active reviewers in the same team.
create or replace function public.notify_on_submission_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_title text;
  m record;
begin
  if new.status <> 'submitted' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then return new; end if;

  select title into v_assignment_title
  from public.assignments where id = new.assignment_id;

  for m in
    select tm.user_id
    from public.team_members tm
    where tm.team_id = new.team_id
      and tm.membership_status = 'active'
      and tm.role in ('admin', 'leader')
      and tm.user_id <> new.user_id
  loop
    perform public.create_notification(
      m.user_id,
      new.team_id,
      'submission_received',
      'Submission ready for review',
      coalesce(v_assignment_title, 'An assignment') || ' has a new submission.',
      'submission',
      new.id,
      '/submissions/' || new.id::text
    );
  end loop;
  return new;
end;
$$;
revoke all on function public.notify_on_submission_received() from public, anon, authenticated;
drop trigger if exists submissions_notify_received on public.submissions;
create trigger submissions_notify_received
  after insert or update on public.submissions
  for each row execute function public.notify_on_submission_received();

-- Discussion reply -> notify the thread owner and direct parent author.
create or replace function public.notify_on_discussion_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread record;
  v_parent_author uuid;
  v_recipient uuid;
begin
  if new.parent_post_id is null then return new; end if;

  select th.id, th.team_id, th.title, th.created_by
    into v_thread
  from public.discussion_threads th
  where th.id = new.thread_id;

  if v_thread.id is null then return new; end if;

  select dp.author_id into v_parent_author
  from public.discussion_posts dp
  where dp.id = new.parent_post_id;

  for v_recipient in
    select distinct candidates.user_id
    from unnest(array[v_thread.created_by, v_parent_author]) as candidates(user_id)
    join public.team_members tm
      on tm.user_id = candidates.user_id
     and tm.team_id = v_thread.team_id
     and tm.membership_status = 'active'
    where candidates.user_id is not null
      and candidates.user_id <> new.author_id
  loop
    perform public.create_notification(
      v_recipient,
      v_thread.team_id,
      'discussion_reply',
      'New reply in: ' || v_thread.title,
      left(new.body, 240),
      'discussion',
      v_thread.id,
      '/discussions/' || v_thread.id::text
    );
  end loop;
  return new;
end;
$$;
revoke all on function public.notify_on_discussion_reply() from public, anon, authenticated;
drop trigger if exists discussion_posts_notify_reply on public.discussion_posts;
create trigger discussion_posts_notify_reply
  after insert on public.discussion_posts
  for each row execute function public.notify_on_discussion_reply();

-- Blocker comment -> notify the requester and assigned helper.
create or replace function public.notify_on_blocker_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocker record;
  v_recipient uuid;
begin
  select b.id, b.team_id, b.user_id, b.assigned_helper, b.title
    into v_blocker
  from public.blockers b
  where b.id = new.blocker_id;

  if v_blocker.id is null then return new; end if;

  for v_recipient in
    select distinct candidates.user_id
    from unnest(array[v_blocker.user_id, v_blocker.assigned_helper]) as candidates(user_id)
    join public.team_members tm
      on tm.user_id = candidates.user_id
     and tm.team_id = v_blocker.team_id
     and tm.membership_status = 'active'
    where candidates.user_id is not null
      and candidates.user_id <> new.author_id
  loop
    perform public.create_notification(
      v_recipient,
      v_blocker.team_id,
      'blocker_response',
      'New response to: ' || v_blocker.title,
      left(new.body, 240),
      'blocker',
      v_blocker.id,
      '/blockers/' || v_blocker.id::text
    );
  end loop;
  return new;
end;
$$;
revoke all on function public.notify_on_blocker_response() from public, anon, authenticated;
drop trigger if exists blocker_comments_notify_response on public.blocker_comments;
create trigger blocker_comments_notify_response
  after insert on public.blocker_comments
  for each row execute function public.notify_on_blocker_response();

-- Status change -> notify the blocker requester (owner status changes are not
-- exposed by the current app action, so this covers leader/admin resolutions).
create or replace function public.notify_on_blocker_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then return new; end if;

  if not exists (
    select 1 from public.team_members tm
    where tm.team_id = new.team_id
      and tm.user_id = new.user_id
      and tm.membership_status = 'active'
  ) then
    return new;
  end if;

  perform public.create_notification(
    new.user_id,
    new.team_id,
    'blocker_updated',
    'Your help request was updated',
    'Status changed to ' || replace(new.status::text, '_', ' ') || '.',
    'blocker',
    new.id,
    '/blockers/' || new.id::text
  );
  return new;
end;
$$;
revoke all on function public.notify_on_blocker_status_change() from public, anon, authenticated;
drop trigger if exists blockers_notify_status_change on public.blockers;
create trigger blockers_notify_status_change
  after update of status on public.blockers
  for each row execute function public.notify_on_blocker_status_change();
