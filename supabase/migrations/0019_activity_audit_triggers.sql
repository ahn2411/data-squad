-- Write privacy-preserving activity records for meaningful platform changes.
-- RLS intentionally has no client insert policy on activity_logs; this
-- SECURITY DEFINER trigger is the only application writer.
create or replace function public.log_activity_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_team_id uuid;
  v_entity_id uuid;
  v_metadata jsonb := jsonb_build_object('operation', lower(TG_OP));
  v_actor_id uuid := auth.uid();
begin
  if TG_OP = 'DELETE' then
    v_row := to_jsonb(OLD);
  else
    v_row := to_jsonb(NEW);
  end if;

  v_entity_id := (v_row ->> 'id')::uuid;

  if v_row ? 'status' then
    v_metadata := v_metadata || jsonb_build_object('status', v_row -> 'status');
  elsif v_row ? 'membership_status' then
    v_metadata := v_metadata || jsonb_build_object('membership_status', v_row -> 'membership_status');
  elsif v_row ? 'publication_status' then
    v_metadata := v_metadata || jsonb_build_object('publication_status', v_row -> 'publication_status');
  elsif v_row ? 'review_status' then
    v_metadata := v_metadata || jsonb_build_object('review_status', v_row -> 'review_status');
  end if;

  if v_row ? 'team_id' then
    v_team_id := (v_row ->> 'team_id')::uuid;
  elsif TG_TABLE_NAME = 'discussion_posts' then
    select t.team_id into v_team_id
    from public.discussion_threads t
    where t.id = (v_row ->> 'thread_id')::uuid;
  elsif TG_TABLE_NAME = 'blocker_comments' then
    select b.team_id into v_team_id
    from public.blockers b
    where b.id = (v_row ->> 'blocker_id')::uuid;
  elsif TG_TABLE_NAME = 'reviews' then
    select s.team_id into v_team_id
    from public.submissions s
    where s.id = (v_row ->> 'submission_id')::uuid;
  end if;

  -- A missing parent can occur during cascading deletion. Do not make that
  -- unrelated deletion fail because an audit context is no longer available.
  if v_team_id is null or not exists (
    select 1 from public.teams t where t.id = v_team_id
  ) then
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;

  -- During account deletion the actor's profile can already be disappearing.
  -- Leave actor attribution null instead of causing the original delete to fail.
  if v_actor_id is not null and not exists (
    select 1 from public.profiles p where p.id = v_actor_id
  ) then
    v_actor_id := null;
  end if;

  insert into public.activity_logs (team_id, user_id, action, entity_type, entity_id, metadata)
  values (
    v_team_id,
    v_actor_id,
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    v_entity_id,
    v_metadata
  );

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

revoke all on function public.log_activity_change() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  -- These tables carry team_id directly. Record inserts, updates and deletes.
  foreach v_table in array array[
    'team_members',
    'assignments',
    'submissions',
    'weekly_reports',
    'discussion_threads',
    'blockers',
    'announcements'
  ] loop
    execute format('drop trigger if exists %I_activity_log on public.%I', v_table, v_table);
    execute format(
      'create trigger %I_activity_log after insert or update or delete on public.%I for each row execute function public.log_activity_change()',
      v_table, v_table
    );
  end loop;

  -- Child records derive team scope from their parent. Avoid delete triggers
  -- here because cascades may remove the parent before the child audit runs.
  foreach v_table in array array[
    'discussion_posts',
    'blocker_comments',
    'reviews'
  ] loop
    execute format('drop trigger if exists %I_activity_log on public.%I', v_table, v_table);
    execute format(
      'create trigger %I_activity_log after insert or update on public.%I for each row execute function public.log_activity_change()',
      v_table, v_table
    );
  end loop;
end $$;
