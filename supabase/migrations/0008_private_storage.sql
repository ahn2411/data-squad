-- Private, team-scoped object storage for profile images and learning files.
-- Objects must use the path: <team_uuid>/<user_uuid>/<filename>.
-- Upload workflows are enabled only after the matching UI ships.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('squad-avatars', 'squad-avatars', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('squad-attachments', 'squad-attachments', false, 10485760,
    array[
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'text/plain', 'text/csv', 'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "squad_storage_team_read" on storage.objects;
create policy "squad_storage_team_read" on storage.objects
  for select to authenticated
  using (
    (
      bucket_id = 'squad-avatars'
      and exists (
        select 1 from public.team_members tm
        where tm.team_id::text = (storage.foldername(name))[1]
          and public.is_active_member_of(tm.team_id)
      )
    )
    or (
      bucket_id = 'squad-attachments'
      and exists (
        select 1 from public.team_members tm
        where tm.team_id::text = (storage.foldername(name))[1]
          and (
            (tm.user_id = auth.uid() and tm.membership_status = 'active')
            or public.is_team_leader_or_admin_of(tm.team_id)
          )
      )
    )
  );

drop policy if exists "squad_storage_owner_insert" on storage.objects;
create policy "squad_storage_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('squad-avatars', 'squad-attachments')
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and tm.user_id = auth.uid()
        and tm.membership_status = 'active'
    )
  );

drop policy if exists "squad_storage_owner_update" on storage.objects;
create policy "squad_storage_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('squad-avatars', 'squad-attachments')
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and tm.user_id = auth.uid()
        and tm.membership_status = 'active'
    )
  )
  with check (
    bucket_id in ('squad-avatars', 'squad-attachments')
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and tm.user_id = auth.uid()
        and tm.membership_status = 'active'
    )
  );

drop policy if exists "squad_storage_owner_delete" on storage.objects;
create policy "squad_storage_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('squad-avatars', 'squad-attachments')
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and tm.user_id = auth.uid()
        and tm.membership_status = 'active'
    )
  );
