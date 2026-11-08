-- New signups should appear in the admin roster as pending approvals.
-- The first account may be registered before the launch team exists; in that
-- case bootstrap-admin.sql creates its membership after creating the team.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_team_id uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  select id into v_team_id
  from public.teams
  order by created_at asc
  limit 1;

  if v_team_id is not null then
    insert into public.team_members (team_id, user_id, role, membership_status)
    values (v_team_id, new.id, 'member', 'pending_approval')
    on conflict (team_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Notify every active team admin when a new pending membership is created.
create or replace function public.notify_admins_pending_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_admin record;
  v_full_name text;
  v_email text;
begin
  if new.membership_status <> 'pending_approval' or new.role <> 'member' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.membership_status = 'pending_approval'
     and old.role = 'member' then
    return new;
  end if;

  select p.full_name, p.email into v_full_name, v_email
  from public.profiles p
  where p.id = new.user_id;

  for v_admin in
    select tm.user_id
    from public.team_members tm
    where tm.team_id = new.team_id
      and tm.role = 'admin'
      and tm.membership_status = 'active'
  loop
    perform public.create_notification(
      v_admin.user_id,
      new.team_id,
      'pending_member_review',
      'New member awaiting review',
      coalesce(v_full_name, v_email, 'A new member') || ' requested access.',
      'team_member',
      new.id,
      '/admin/members'
    );
  end loop;

  return new;
end;
$$;
revoke all on function public.notify_admins_pending_member() from public, anon, authenticated;

drop trigger if exists team_members_notify_pending on public.team_members;
create trigger team_members_notify_pending
  after insert or update on public.team_members
  for each row execute function public.notify_admins_pending_member();

-- Accounts that registered before this migration had a profile but no team
-- membership. Add them to the launch team as pending and notify its admins.
insert into public.team_members (team_id, user_id, role, membership_status)
select team_id, p.id, 'member', 'pending_approval'
from public.profiles p
cross join lateral (
  select id as team_id
  from public.teams
  order by created_at asc
  limit 1
) launch_team
where not exists (
  select 1
  from public.team_members tm
  where tm.team_id = launch_team.team_id
    and tm.user_id = p.id
)
on conflict (team_id, user_id) do nothing;

-- Also notify admins about pending rows that existed before the notification
-- trigger was installed. The entity check makes this safe to rerun.
insert into public.notifications (
  user_id, team_id, type, title, body, entity_type, entity_id, link
)
select
  admins.user_id,
  pending.team_id,
  'pending_member_review',
  'New member awaiting review',
  coalesce(profile.full_name, profile.email, 'A new member') || ' requested access.',
  'team_member',
  pending.id,
  '/admin/members'
from public.team_members pending
join public.profiles profile on profile.id = pending.user_id
join public.team_members admins
  on admins.team_id = pending.team_id
  and admins.role = 'admin'
  and admins.membership_status = 'active'
where pending.membership_status = 'pending_approval'
  and pending.role = 'member'
  and not exists (
    select 1 from public.notifications existing
    where existing.user_id = admins.user_id
      and existing.type = 'pending_member_review'
      and existing.entity_type = 'team_member'
      and existing.entity_id = pending.id
  );
