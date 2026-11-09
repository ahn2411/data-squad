-- Store the learner's checklist confirmation with each completion. Existing
-- completed work is preserved by snapshotting each topic's current criteria.
alter table public.topic_progress
  add column if not exists completed_criteria jsonb not null default '[]'::jsonb;

update public.topic_progress tp
set completed_criteria = t.completion_criteria
from public.topics t
where tp.topic_id = t.id
  and tp.status = 'completed'
  and tp.completed_criteria = '[]'::jsonb;

alter table public.topic_progress
  drop constraint if exists topic_progress_completed_criteria_array_check;
alter table public.topic_progress
  add constraint topic_progress_completed_criteria_array_check
  check (jsonb_typeof(completed_criteria) = 'array');

create or replace function public.enforce_topic_progress_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_criteria jsonb;
begin
  select t.completion_criteria into v_criteria
  from public.topics t
  where t.id = new.topic_id;
  if not found then
    raise exception 'topic_not_found';
  end if;

  if new.status = 'completed' then
    if jsonb_typeof(v_criteria) <> 'array'
      or jsonb_array_length(v_criteria) = 0 then
      raise exception 'topic_completion_criteria_not_configured';
    end if;
    if new.completed_criteria is distinct from v_criteria then
      raise exception 'topic_completion_checklist_incomplete';
    end if;
    new.started_at := coalesce(new.started_at, now());
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_criteria := '[]'::jsonb;
    new.completed_at := null;
    if new.status = 'in_progress' then
      new.started_at := coalesce(new.started_at, now());
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_topic_progress_completion() from public, anon, authenticated;
drop trigger if exists topic_progress_completion_guard on public.topic_progress;
create trigger topic_progress_completion_guard
  before insert or update on public.topic_progress
  for each row execute function public.enforce_topic_progress_completion();
