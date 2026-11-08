-- Add a notification type for admin review of new member requests.
-- Keep this in a separate migration so PostgreSQL commits the enum value
-- before a later migration uses it in trigger code.
alter type public.notification_type
  add value if not exists 'pending_member_review';
