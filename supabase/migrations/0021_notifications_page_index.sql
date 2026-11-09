-- Support the notification center's user-scoped unread-first pagination order.
create index if not exists notifications_user_page_idx
  on public.notifications (
    user_id,
    read_at asc nulls first,
    created_at desc,
    id asc
  );
