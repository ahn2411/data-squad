-- Let each member share their final capstone repository through the existing
-- profile record; no separate project table is needed for a single portfolio link.
alter table public.profiles
  add column if not exists capstone_repository_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_capstone_repository_url_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_capstone_repository_url_format
      check (
        capstone_repository_url is null
        or capstone_repository_url ~ '^https://github\.com/[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*/?$'
      );
  end if;
end;
$$;
