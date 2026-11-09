-- Persist each learner's explicit confirmation of weekly deliverables. Topic
-- completion remains in topic_progress; this is a separate week-level signal.
create table if not exists public.week_progress (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_deliverables jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completed_deliverables) = 'array'),
  completed_criteria jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completed_criteria) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, user_id)
);
create index if not exists week_progress_user_idx on public.week_progress(user_id, week_id);
create trigger week_progress_set_updated_at
  before update on public.week_progress
  for each row execute function public.set_updated_at();

create or replace function public.validate_week_progress_deliverables()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deliverables jsonb;
  v_criteria jsonb;
  v_selected_count integer;
  v_distinct_count integer;
begin
  select w.deliverables, w.completion_criteria into v_deliverables, v_criteria
  from public.weeks w where w.id = new.week_id;
  if not found then raise exception 'week_not_found'; end if;
  if jsonb_typeof(new.completed_deliverables) <> 'array' then
    raise exception 'week_deliverables_must_be_array';
  end if;

  select count(*), count(distinct value)
    into v_selected_count, v_distinct_count
  from jsonb_array_elements_text(new.completed_deliverables) selected(value);
  if v_selected_count <> v_distinct_count then
    raise exception 'duplicate_week_deliverable';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(new.completed_deliverables) selected(value)
    where not (v_deliverables @> jsonb_build_array(selected.value))
  ) then
    raise exception 'unknown_week_deliverable';
  end if;

  if jsonb_typeof(v_criteria) <> 'array' then
    raise exception 'week_criteria_not_configured';
  end if;
  select count(*), count(distinct value)
    into v_selected_count, v_distinct_count
  from jsonb_array_elements_text(new.completed_criteria) selected(value);
  if v_selected_count <> v_distinct_count then
    raise exception 'duplicate_week_criterion';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(new.completed_criteria) selected(value)
    where not (v_criteria @> jsonb_build_array(selected.value))
  ) then
    raise exception 'unknown_week_criterion';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_week_progress_deliverables() from public, anon, authenticated;
create trigger week_progress_validate_deliverables
  before insert or update on public.week_progress
  for each row execute function public.validate_week_progress_deliverables();

alter table public.week_progress enable row level security;
revoke all on table public.week_progress from anon, authenticated;
grant select, insert, update, delete on table public.week_progress to authenticated;
drop policy if exists "week_progress_select" on public.week_progress;
create policy "week_progress_select" on public.week_progress
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.weeks w
      join public.team_members tm on tm.team_id = w.team_id
      where w.id = week_progress.week_id
        and tm.user_id = auth.uid()
        and tm.role in ('admin', 'leader')
        and tm.membership_status = 'active'
    )
  );
drop policy if exists "week_progress_self_insert" on public.week_progress;
create policy "week_progress_self_insert" on public.week_progress
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.weeks w
      where w.id = week_progress.week_id
        and w.status = 'published'
        and public.is_active_member_of(w.team_id)
    )
  );
drop policy if exists "week_progress_self_update" on public.week_progress;
create policy "week_progress_self_update" on public.week_progress
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.weeks w
      where w.id = week_progress.week_id
        and w.status = 'published'
        and public.is_active_member_of(w.team_id)
    )
  );
drop policy if exists "week_progress_self_delete" on public.week_progress;
create policy "week_progress_self_delete" on public.week_progress
  for delete to authenticated using (user_id = auth.uid());
