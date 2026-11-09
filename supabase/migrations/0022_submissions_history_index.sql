-- Support stable, newest-first pagination for each member's submission history.
create index if not exists submissions_user_history_page_idx
  on public.submissions (user_id, submitted_at desc nulls last, id desc);
