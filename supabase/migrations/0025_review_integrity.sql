-- Reviews are append-only audit records. Keep the existing review read policy,
-- but restrict writes to inserts so a client cannot rewrite/delete history.
drop policy if exists "reviews_leader_write" on public.reviews;
drop policy if exists "reviews_leader_insert" on public.reviews;
create policy "reviews_leader_insert" on public.reviews
  for insert with check (
    public.is_team_leader_or_admin_of(
      (select team_id from public.submissions s where s.id = submission_id)
    )
    and reviewer_id = auth.uid()
  );

-- Serialize review decisions on the submission row and enforce valid source
-- states and assignment score bounds even when a request bypasses the app.
create or replace function public.validate_review_submission_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_status public.submission_status;
  v_max_score integer;
begin
  select s.status, a.max_score
    into v_status, v_max_score
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = new.submission_id
  for update of s;

  if not found then
    raise exception 'review_submission_not_found';
  end if;

  if v_status not in ('submitted', 'under_review') then
    raise exception 'submission_not_reviewable';
  end if;

  if new.score is not null and (
    new.score < 0
    or (v_max_score is not null and new.score > v_max_score)
  ) then
    raise exception 'review_score_out_of_range';
  end if;

  return new;
end;
$$;
revoke all on function public.validate_review_submission_transition() from public, anon, authenticated;
drop trigger if exists reviews_validate_submission_transition on public.reviews;
create trigger reviews_validate_submission_transition
  before insert on public.reviews
  for each row execute function public.validate_review_submission_transition();
