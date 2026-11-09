-- The original curriculum seed (0005) uses ON CONFLICT DO UPDATE. Keep that
-- historical migration intact, but prevent a later seed rerun under a
-- migration/service context from replacing curriculum rows edited since
-- creation. Authenticated administrator edits through the app remain allowed.
create or replace function public.preserve_admin_curriculum_edits()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null and old.updated_at > old.created_at then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_admin_curriculum_edits() from public, anon, authenticated;

drop trigger if exists a_curriculum_seed_preserve_edits on public.phases;
drop trigger if exists zzz_curriculum_seed_preserve_edits on public.phases;
create trigger zzz_curriculum_seed_preserve_edits
  before update on public.phases
  for each row execute function public.preserve_admin_curriculum_edits();

drop trigger if exists a_curriculum_seed_preserve_edits on public.weeks;
drop trigger if exists zzz_curriculum_seed_preserve_edits on public.weeks;
create trigger zzz_curriculum_seed_preserve_edits
  before update on public.weeks
  for each row execute function public.preserve_admin_curriculum_edits();

drop trigger if exists a_curriculum_seed_preserve_edits on public.topics;
drop trigger if exists zzz_curriculum_seed_preserve_edits on public.topics;
create trigger zzz_curriculum_seed_preserve_edits
  before update on public.topics
  for each row execute function public.preserve_admin_curriculum_edits();
