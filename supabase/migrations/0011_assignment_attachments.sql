-- Persist metadata for private assignment resources. File bytes remain in the
-- private squad-attachments bucket; the normal can_access_assignment helper
-- controls which members may download a published assignment's resources.
-- A composite unique index lets metadata enforce that assignment/team ids
-- belong together without relying on a client-supplied team id.
create unique index if not exists assignments_id_team_uq
  on public.assignments(id, team_id);

create table if not exists public.assignment_files (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint assignment_files_team_assignment_fk
    foreign key (assignment_id, team_id)
    references public.assignments(id, team_id) on delete cascade
);

create index if not exists assignment_files_assignment_idx
  on public.assignment_files(assignment_id, created_at);

-- Serialize writes per assignment so concurrent uploads cannot bypass the
-- server action's ten-file cap.
create or replace function public.enforce_assignment_file_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file_count integer;
begin
  perform 1 from public.assignments a
    where a.id = new.assignment_id and a.team_id = new.team_id
    for update;
  if not found then
    raise exception 'Assignment not found for this team';
  end if;

  select count(*) into v_file_count
  from public.assignment_files af
  where af.assignment_id = new.assignment_id;
  if v_file_count >= 10 then
    raise exception 'An assignment can have at most 10 attached files';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_assignment_file_limit() from public, anon, authenticated;
drop trigger if exists assignment_files_limit on public.assignment_files;
create trigger assignment_files_limit
  before insert on public.assignment_files
  for each row execute function public.enforce_assignment_file_limit();

alter table public.assignment_files enable row level security;

drop policy if exists "assignment_files_select" on public.assignment_files;
create policy "assignment_files_select" on public.assignment_files
  for select to authenticated using (
    public.can_access_assignment(assignment_id)
    and public.is_active_member_of(team_id)
  );

drop policy if exists "assignment_files_leader_insert" on public.assignment_files;
create policy "assignment_files_leader_insert" on public.assignment_files
  for insert to authenticated with check (
    uploaded_by = auth.uid()
    and public.is_team_leader_or_admin_of(team_id)
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_files.assignment_id
        and a.team_id = assignment_files.team_id
    )
  );

drop policy if exists "assignment_files_leader_delete" on public.assignment_files;
create policy "assignment_files_leader_delete" on public.assignment_files
  for delete to authenticated using (
    public.is_team_leader_or_admin_of(team_id)
  );

-- Assignment objects use <team>/<uploader>/assignments/<assignment>/<uuid>-<name>.
-- Rebuild the broad 0008 owner policies with assignment-aware branches. Keep
-- avatar and member-submission behavior intact while requiring leaders to
-- upload/manage assignment resources.
drop policy if exists "squad_storage_team_read" on storage.objects;
create policy "squad_storage_team_read" on storage.objects
  for select to authenticated using (
    (bucket_id = 'squad-avatars' and exists (
      select 1 from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and public.is_active_member_of(tm.team_id)
    ))
    or (bucket_id = 'squad-attachments' and (
      exists (
        select 1 from public.team_members tm
        where tm.team_id::text = (storage.foldername(name))[1]
          and (
            (tm.user_id = auth.uid() and tm.membership_status = 'active')
            or public.is_team_leader_or_admin_of(tm.team_id)
          )
      )
      or (
        (storage.foldername(name))[3] = 'assignments'
        and exists (
          select 1 from public.assignments a
          where a.id::text = (storage.foldername(name))[4]
            and a.team_id::text = (storage.foldername(name))[1]
            and public.can_access_assignment(a.id)
        )
      )
    ))
  );

drop policy if exists "squad_storage_owner_insert" on storage.objects;
create policy "squad_storage_owner_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('squad-avatars', 'squad-attachments')
    and (storage.foldername(name))[2] = auth.uid()::text
    and (
      ((storage.foldername(name))[3] is distinct from 'assignments'
        and exists (
          select 1 from public.team_members tm
          where tm.team_id::text = (storage.foldername(name))[1]
            and tm.user_id = auth.uid() and tm.membership_status = 'active'
        ))
      or (bucket_id = 'squad-attachments'
        and (storage.foldername(name))[3] = 'assignments'
        and exists (
          select 1 from public.assignments a
          where a.id::text = (storage.foldername(name))[4]
            and a.team_id::text = (storage.foldername(name))[1]
            and public.is_team_leader_or_admin_of(a.team_id)
        ))
    )
  );

drop policy if exists "squad_storage_owner_update" on storage.objects;
create policy "squad_storage_owner_update" on storage.objects
  for update to authenticated using (
    bucket_id in ('squad-avatars', 'squad-attachments')
    and (storage.foldername(name))[2] = auth.uid()::text
    and (
      ((storage.foldername(name))[3] is distinct from 'assignments'
        and exists (
          select 1 from public.team_members tm
          where tm.team_id::text = (storage.foldername(name))[1]
            and tm.user_id = auth.uid() and tm.membership_status = 'active'
        ))
      or (bucket_id = 'squad-attachments'
        and (storage.foldername(name))[3] = 'assignments'
        and exists (
          select 1 from public.assignments a
          where a.id::text = (storage.foldername(name))[4]
            and a.team_id::text = (storage.foldername(name))[1]
            and public.is_team_leader_or_admin_of(a.team_id)
        ))
    )
  ) with check (
    bucket_id in ('squad-avatars', 'squad-attachments')
    and (storage.foldername(name))[2] = auth.uid()::text
    and (
      ((storage.foldername(name))[3] is distinct from 'assignments'
        and exists (
          select 1 from public.team_members tm
          where tm.team_id::text = (storage.foldername(name))[1]
            and tm.user_id = auth.uid() and tm.membership_status = 'active'
        ))
      or (bucket_id = 'squad-attachments'
        and (storage.foldername(name))[3] = 'assignments'
        and exists (
          select 1 from public.assignments a
          where a.id::text = (storage.foldername(name))[4]
            and a.team_id::text = (storage.foldername(name))[1]
            and public.is_team_leader_or_admin_of(a.team_id)
        ))
    )
  );

drop policy if exists "squad_storage_owner_delete" on storage.objects;
create policy "squad_storage_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id in ('squad-avatars', 'squad-attachments')
    and (storage.foldername(name))[2] = auth.uid()::text
    and (
      ((storage.foldername(name))[3] is distinct from 'assignments'
        and exists (
          select 1 from public.team_members tm
          where tm.team_id::text = (storage.foldername(name))[1]
            and tm.user_id = auth.uid() and tm.membership_status = 'active'
        ))
      or (bucket_id = 'squad-attachments'
        and (storage.foldername(name))[3] = 'assignments'
        and exists (
          select 1 from public.assignments a
          where a.id::text = (storage.foldername(name))[4]
            and a.team_id::text = (storage.foldername(name))[1]
            and public.is_team_leader_or_admin_of(a.team_id)
        ))
    )
  );
