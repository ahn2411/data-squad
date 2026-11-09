-- Add event types separately so trigger functions in 0010 can use committed labels.
alter type public.notification_type add value if not exists 'submission_received';
alter type public.notification_type add value if not exists 'discussion_reply';
alter type public.notification_type add value if not exists 'blocker_response';
