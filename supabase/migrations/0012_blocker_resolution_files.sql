-- Add a distinct closed state. Keep existing blocker rows unchanged.
alter type public.blocker_status add value if not exists 'closed';

create unique index if not exists blockers_id_team_uq
  on public.blockers(id, team_id);

create table if not exists public.blocker_files (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.blockers(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint blocker_files_team_blocker_fk
    foreign key (blocker_id, team_id)
    references public.blockers(id, team_id) on delete cascade
);
create index if not exists blocker_files_blocker_idx
  on public.blocker_files(blocker_id, created_at);

create or replace function public.enforce_blocker_file_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file_count integer;
begin
  perform 1 from public.blockers b
    where b.id = new.blocker_id and b.team_id = new.team_id
    for update;
  if not found then
    raise exception 'Blocker not found for this team';
  end if;
  select count(*) into v_file_count from public.blocker_files bf
    where bf.blocker_id = new.blocker_id;
  if v_file_count >= 10 then
    raise exception 'A blocker can have at most 10 attachments';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_blocker_file_limit() from public, anon, authenticated;
drop trigger if exists blocker_files_limit on public.blocker_files;
create trigger blocker_files_limit
  before insert on public.blocker_files
  for each row execute function public.enforce_blocker_file_limit();

alter table public.blocker_files enable row level security;

drop policy if exists "blocker_files_select" on public.blocker_files;
create policy "blocker_files_select" on public.blocker_files
  for select to authenticated using (
    public.is_active_member_of(team_id)
    and exists (select 1 from public.blockers b
      where b.id = blocker_files.blocker_id and b.team_id = blocker_files.team_id)
  );
drop policy if exists "blocker_files_insert" on public.blocker_files;
create policy "blocker_files_insert" on public.blocker_files
  for insert to authenticated with check (
    uploaded_by = auth.uid()
    and public.is_active_member_of(team_id)
    and exists (select 1 from public.blockers b
      where b.id = blocker_files.blocker_id and b.team_id = blocker_files.team_id
        and (b.user_id = auth.uid() or public.is_team_leader_or_admin_of(b.team_id)))
  );
drop policy if exists "blocker_files_delete" on public.blocker_files;
create policy "blocker_files_delete" on public.blocker_files
  for delete to authenticated using (
    public.is_active_member_of(team_id)
    and exists (select 1 from public.blockers b
      where b.id = blocker_files.blocker_id and b.team_id = blocker_files.team_id
        and (b.user_id = auth.uid() or public.is_team_leader_or_admin_of(b.team_id)))
  );

-- Member-owned object paths remain compatible with the 0008 owner policy:
-- <team>/<uploader>/blockers/<blocker>/<uuid>-<filename>.
-- Registered blocker files are readable by active teammates and removable by
-- leaders even when the reporter uploaded the object.
drop policy if exists "squad_blocker_files_read" on storage.objects;
create policy "squad_blocker_files_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'squad-attachments'
    and (storage.foldername(name))[3] = 'blockers'
    and exists (
      select 1 from public.blocker_files bf
      where bf.storage_path = storage.objects.name
        and public.is_active_member_of(bf.team_id)
    )
  );
drop policy if exists "squad_blocker_files_manager_delete" on storage.objects;
create policy "squad_blocker_files_manager_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'squad-attachments'
    and (storage.foldername(name))[3] = 'blockers'
    and exists (
      select 1 from public.blocker_files bf
      where bf.storage_path = storage.objects.name
        and public.is_team_leader_or_admin_of(bf.team_id)
    )
  );
drop policy if exists "squad_blocker_files_reporter_delete" on storage.objects;
create policy "squad_blocker_files_reporter_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'squad-attachments'
    and (storage.foldername(name))[3] = 'blockers'
    and exists (
      select 1 from public.blocker_files bf
      join public.blockers b on b.id = bf.blocker_id and b.team_id = bf.team_id
      where bf.storage_path = storage.objects.name
        and b.user_id = auth.uid()
        and public.is_active_member_of(b.team_id)
    )
  );

-- Blocker owners may close a request and reopen a closed/resolved request.
-- Resolution and helper assignment remain leader/admin-only.
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
    and not public.is_team_leader_or_admin_of(old.team_id) then
    if new.assigned_helper is distinct from old.assigned_helper
      or new.resolution_notes is distinct from old.resolution_notes then
      raise exception 'blocker_status_leader_only';
    end if;
    if new.status is distinct from old.status
      and not (
        new.status = 'closed'
        or (new.status = 'open' and old.status in ('closed', 'resolved'))
      ) then
      raise exception 'invalid_blocker_owner_transition';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_blocker_update() from public, anon, authenticated;

-- The reporter initiated their own close/reopen action, so do not send them
-- a redundant notification for that status update.
create or replace function public.notify_on_blocker_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status or new.user_id = auth.uid() then
    return new;
  end if;
  if not exists (
    select 1 from public.team_members tm
    where tm.team_id = new.team_id and tm.user_id = new.user_id
      and tm.membership_status = 'active'
  ) then
    return new;
  end if;
  perform public.create_notification(
    new.user_id, new.team_id, 'blocker_updated',
    'Your help request was updated',
    'Status changed to ' || replace(new.status::text, '_', ' ') || '.',
    'blocker', new.id, '/blockers/' || new.id::text
  );
  return new;
end;
$$;
revoke all on function public.notify_on_blocker_status_change() from public, anon, authenticated;
