-- Give team admins and leaders access to contact details only for pending
-- approval requests in their own team. Email remains private in profiles for
-- all other member queries.
create or replace function public.get_pending_member_contacts()
returns table (
  user_id uuid,
  full_name text,
  email text
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p.id, p.full_name, p.email
  from public.team_members as pending
  join public.profiles as p on p.id = pending.user_id
  where pending.team_id = (
    select caller.team_id
    from public.team_members as caller
    where caller.user_id = auth.uid()
      and caller.membership_status = 'active'
      and caller.role in ('admin', 'leader')
    limit 1
  )
    and pending.membership_status = 'pending_approval'
$$;

revoke all on function public.get_pending_member_contacts() from public, anon;
grant execute on function public.get_pending_member_contacts() to authenticated;
