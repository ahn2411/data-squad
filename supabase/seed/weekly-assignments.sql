-- Idempotently create one reviewable assignment draft for each curriculum
-- week that does not already have an assignment. Run after bootstrap-admin.sql.
--
-- Draft status is intentional: reviewing and publishing these through the
-- admin UI prevents a seed run from sending 24 assignment notifications to
-- every active member. Existing assignments and submissions are never changed.
do $weekly_assignments$
declare
  v_team_id uuid;
  v_admin_id uuid;
  v_inserted integer;
begin
  -- Serialize concurrent runs so the NOT EXISTS check remains idempotent.
  perform pg_advisory_xact_lock(hashtextextended('data-squad-weekly-assignment-seed', 0));

  select id into v_team_id
  from public.teams
  where slug = 'data-science-squad';

  if v_team_id is null then
    raise exception 'Data Science Squad team is missing; apply curriculum migrations first.';
  end if;

  select user_id into v_admin_id
  from public.team_members
  where team_id = v_team_id
    and role = 'admin'
    and membership_status = 'active'
  order by joined_at nulls last, created_at, user_id
  limit 1;

  if v_admin_id is null then
    raise exception 'No active admin found. Run bootstrap-admin.sql before this seed.';
  end if;

  insert into public.assignments (
    team_id,
    title,
    description,
    instructions,
    phase_id,
    week_id,
    assignment_type,
    difficulty,
    supporting_resources,
    deliverables,
    evaluation_criteria,
    publication_status,
    created_by,
    display_order
  )
  select
    w.team_id,
    format('Week %s: %s — Weekly Assignment', lpad(w.week_number::text, 2, '0'), w.title),
    w.overview,
    concat_ws(
      E'\n\n',
      'Complete the practical work for this week and submit the listed deliverables.',
      case when jsonb_array_length(coalesce(w.deliverables, '[]'::jsonb)) > 0 then
        'Suggested tasks:' || E'\n' || (
          select string_agg('- ' || item, E'\n' order by ordinal)
          from jsonb_array_elements_text(coalesce(w.deliverables, '[]'::jsonb))
            with ordinality as task(item, ordinal)
        )
      end,
      case when jsonb_array_length(coalesce(w.completion_criteria, '[]'::jsonb)) > 0 then
        'Completion criteria:' || E'\n' || (
          select string_agg('- ' || item, E'\n' order by ordinal)
          from jsonb_array_elements_text(coalesce(w.completion_criteria, '[]'::jsonb))
            with ordinality as criterion(item, ordinal)
        )
      end,
      'Include a short explanation of your approach and link any code or project repository. Review the assignment page for the final submission format and deadline set by your leader.'
    ),
    w.phase_id,
    w.id,
    case
      when w.week_number between 1 and 4 then 'programming_exercise'::public.assignment_type
      when w.week_number between 5 and 8 then 'written_explanation'::public.assignment_type
      when w.week_number between 9 and 12 then 'data_analysis'::public.assignment_type
      when w.week_number between 13 and 14 then 'programming_exercise'::public.assignment_type
      when w.week_number between 15 and 16 then 'data_analysis'::public.assignment_type
      else 'mini_project'::public.assignment_type
    end,
    case when w.week_number <= 4 then 'beginner'::public.assignment_difficulty
      else 'intermediate'::public.assignment_difficulty end,
    (
      select coalesce(jsonb_agg(to_jsonb(resource_url) order by resource_url), '[]'::jsonb)
      from (
        select distinct lr.url as resource_url
        from public.topics t
        join public.learning_resources lr on lr.topic_id = t.id
        where t.week_id = w.id and t.team_id = w.team_id
      ) as week_resources
    ),
    coalesce(w.deliverables, '[]'::jsonb),
    coalesce(w.completion_criteria, '[]'::jsonb),
    'draft'::public.publication_status,
    v_admin_id,
    w.display_order
  from public.weeks w
  where w.team_id = v_team_id
    and not exists (
      select 1
      from public.assignments existing
      where existing.team_id = w.team_id
        and existing.week_id = w.id
    )
  order by w.week_number;

  get diagnostics v_inserted = row_count;
  raise notice 'Created % weekly assignment drafts; existing assignments were left unchanged.', v_inserted;
end
$weekly_assignments$;
