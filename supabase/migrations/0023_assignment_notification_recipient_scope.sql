-- Repair assignment publish notifications forward-only. In particular, only
-- active selected recipients receive a targeted assignment notification;
-- an empty recipient set continues to mean team-wide assignment.
create or replace function public.notify_on_assignment_publish()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m record;
begin
  if new.publication_status <> 'published' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.publication_status = 'published' then
    return new;
  end if;

  if exists (
    select 1
    from public.assignment_recipients r
    where r.assignment_id = new.id
  ) then
    for m in
      select r.user_id
      from public.assignment_recipients r
      join public.team_members tm
        on tm.team_id = new.team_id
       and tm.user_id = r.user_id
       and tm.membership_status = 'active'
      where r.assignment_id = new.id
    loop
      perform public.create_notification(
        m.user_id,
        new.team_id,
        'new_assignment',
        'New assignment: ' || new.title,
        left(coalesce(new.description, ''), 240),
        'assignment',
        new.id,
        '/assignments/' || new.id::text
      );
    end loop;
  else
    for m in
      select tm.user_id
      from public.team_members tm
      where tm.team_id = new.team_id
        and tm.membership_status = 'active'
    loop
      perform public.create_notification(
        m.user_id,
        new.team_id,
        'new_assignment',
        'New assignment: ' || new.title,
        left(coalesce(new.description, ''), 240),
        'assignment',
        new.id,
        '/assignments/' || new.id::text
      );
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_on_assignment_publish()
  from public, anon, authenticated;

drop trigger if exists assignments_notify on public.assignments;
create trigger assignments_notify
  after insert or update on public.assignments
  for each row execute function public.notify_on_assignment_publish();
