-- Members may revise a report for seven days after its latest save. After
-- that window, only leader feedback remains editable through the normal app.
-- This changes policies/functions forward-only; it does not rewrite reports.
create or replace function public.guard_weekly_report_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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
    if old.submitted_at <= now() - interval '7 days' then
      raise exception 'weekly_report_edit_window_closed';
    end if;
    if new.leader_feedback is distinct from old.leader_feedback then
      raise exception 'weekly_report_feedback_leader_only';
    end if;

    -- The database sets the authoritative edit timestamp so a direct API
    -- caller cannot extend the window by submitting a future timestamp.
    new.submitted_at := now();
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

create or replace function public.set_weekly_report_submission_time()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = new.user_id then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.set_weekly_report_submission_time() from public, anon, authenticated;
drop trigger if exists weekly_reports_submission_time on public.weekly_reports;
create trigger weekly_reports_submission_time
  before insert on public.weekly_reports
  for each row execute function public.set_weekly_report_submission_time();

drop policy if exists "reports_self_delete" on public.weekly_reports;
