-- Give scheduled reminder jobs a stable idempotency key. Existing event
-- notifications remain unchanged because their dedupe_key is null.
alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_uq
  on public.notifications(dedupe_key);
