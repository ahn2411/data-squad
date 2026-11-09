# Testing guide

## Current scripts

- `npm run typecheck` — TypeScript static check.
- `npm run lint` — ESLint.
- `npm run build` — Next.js production build and route prerender validation.

There is no checked-in automated unit, integration, browser, or RLS test suite yet. Do not treat the scripts above as workflow verification.

## Safe workflow test plan

Use a disposable Supabase project or local Supabase stack and three separate accounts (admin, leader, member). Apply migrations to that test database, configure Auth redirect URLs and SMTP/test inbox, then exercise:

1. Signup, email confirmation/invite, approval, login, reset and logout.
   - In a production-like environment set `NEXT_PUBLIC_SITE_URL` to the Vercel HTTPS origin and confirm the generated signup, invite, and recovery `redirectTo` values use `/auth/callback` on that origin. With the env set to localhost but `VERCEL_PROJECT_PRODUCTION_URL` available, confirm production selects the Vercel production origin; with neither configured, confirm auth email requests fail clearly instead of creating localhost links. Confirm the Supabase allowlist and email templates preserve the callback URL through the final link.
   - Verify unauthenticated `/auth/callback?code=...` reaches the callback handler rather than redirecting to login. Verify a legacy root URL containing an auth `code` forwards internally to `/auth/callback`, exchanges once, and then follows the safe `next` destination.
2. Profile update and denial of self-role/status changes.
   - Confirm a member profile shows only that member's team-scoped current phase, published-topic progress, approved-assignment count, report count, and earned milestones. As a leader/admin, open `/admin/members/{userId}` and verify the profile, recent submissions/reports/blockers, team scope, and signed avatar URL; as a member, attempt the route directly and expect a redirect.
3. Curriculum read/edit, topic progress, and phase/week calculations.
   - Apply migration 0028 after the curriculum seed. Confirm the 83 unchanged seeded exercises gain the correct week guide, an exercise edited before applying the migration remains byte-for-byte unchanged, and rerunning the migration does not append duplicate guidance. Edit an exercise through the admin UI afterward and confirm the value saves normally.
   - Force a topic-completion action to return an error and then to reject: verify the checklist remains open with its checked criteria and an error is announced. On success, verify the checklist resets and server-rendered status refreshes. Repeat for week deliverable save and verify failed writes do not clear the selected state.
4. Assignment distribution, attachment upload/download/removal, submission, review, revision, resubmission and approval.
   - Create more than 20 visible assignments. Verify title/description search, each status filter, page counts, out-of-range correction, filter preservation while paging, and that another member's submissions never affect the current member's status filter.
   - As an admin/leader, create more than 20 assignments across draft/published/archived states. Verify the admin list filters in the database, page counts and navigation, search/status preservation, and visible-page recipient/submission counts.
   - Apply migrations 0008 and 0011 in the test project, attach allowed files, try a too-large/disallowed file, confirm eligible-member downloads use signed URLs, and verify an unassigned member cannot read the object or metadata.
5. Weekly report create/update/leader feedback and ownership checks.
   - Select a published week as a leader/admin and compare the missing-report list against active team memberships and report rows. Verify pending/suspended/removed users are excluded, a newly submitted report removes that member from the list, and an identical user in another team does not affect the result.
   - Apply migration 0020; confirm a member can save edits within seven days, each save renews the seven-day window, and an expired report is read-only in the UI and rejected by direct REST. Confirm leaders can update feedback after the member edit cutoff, cannot alter report content, and members cannot delete their report.
6. Discussion post/reply/edit/delete/search and team scope.
7. Blocker create/comment/status/helper assignment and team scope.
   - Create more than 20 blockers for the same member and across the team. Verify member queries never show another member's rows; verify status/priority/text filters, reporter-name search for leaders, page navigation/filter preservation, out-of-range correction, and that the open count remains global across pages/filters.
   - Apply migration 0012; as reporter close an open/in-progress blocker and reopen closed/resolved ones. Confirm direct API attempts to set `being_addressed`, change helper, or edit resolution notes as a reporter are denied.
   - Apply migrations 0013–0014; verify a topic cannot be completed with omitted/altered criteria, and a learner can only save deliverables configured for a published week. Verify members cannot read or alter another learner's progress.
   - Upload a permitted screenshot, reject a disallowed/oversized file, verify active team members can download only registered blocker files, and verify unauthorized users cannot access the object. Check reporter and leader removal rules.
8. Announcement publish/archive and notification read states.
   - Verify notification links with valid internal paths navigate; malformed, external, protocol-relative, backslash, and control-character paths do not create active links. Force mark-read and mark-all actions to fail or reject; verify an error appears, intended valid navigation still works, and the busy indicator clears.
   - Publish more than 20 announcements. Verify title search, pinned-first ordering across page boundaries, exact counts, search preservation while paging, and that drafts/archived items never appear to members.
   - With more than 20 synthetic notifications, verify page counts/order, unread totals across pages, and out-of-range page correction. Mark one and all notifications read; confirm only rows whose `read_at` is SQL NULL are updated and the bell count changes.
   - Apply migration 0021 and verify the notification list query uses the user/read/time index with `EXPLAIN` on a representative fixture dataset.
   - Apply migration 0022 and verify a member's submission history returns 20 rows per page, stable newest-first order for equal timestamps, accurate page counts, out-of-range correction, and no rows belonging to another member.
   - Apply migration 0023; create and publish a targeted assignment and verify only selected active members receive a notification. Verify an assignment with no recipient rows notifies all active members, and that a recipient validation failure leaves the assignment unpublished.
   - Apply migration 0024 and query `pg_proc.proconfig` for every `SECURITY DEFINER` function in `public`; verify each has `search_path=pg_catalog, public, pg_temp` and check that function behavior/RLS helpers still work under member, leader, and admin sessions.
   - Apply migration 0025. As a leader, review a submitted item; verify terminal submissions reject another review, score bounds are enforced, and direct REST update/delete requests against review rows are denied. Run two concurrent decisions against one submission to verify the row lock serializes state transitions.
   - Apply migration 0026. Save a valid `https://github.com/owner/repo` capstone URL and verify it appears only for active members in the GitHub directory; reject non-GitHub hosts and malformed paths in both the form and direct database writes.
   - Apply migration 0027. With a member session, request `profiles` columns `email` and `timezone` directly through PostgREST and confirm the database rejects them while allowed directory fields still work. Call `get_my_profile_timezone()` as that member and verify it returns their saved value; verify it does not return another member's value (the function accepts no user ID). Attempt to update `email`, `id`, or another member's `timezone` directly and confirm denial; confirm the owner can update their own timezone through the profile form.
   - In the admin roadmap manager, edit an existing resource's title, URL, type, description, and free/paid setting; save, reload, and verify persistence. Attempt a stale or cross-team resource ID and confirm the action reports failure without claiming success.
   - Confirm production migration 0015 is applied. Invoke `/api/cron/reminders` without authorization and with a wrong token (expect 401); with `CRON_SECRET` unset, expect 503. Unit-test the authorization guard for missing, invalid, and valid bearer tokens without invoking reminder generation. Against a staging app with synthetic due assignments/reports, make authorized calls repeatedly and verify only one notification is inserted per assignment/user/deadline and report/week/user. Check the GitHub Actions workflow succeeds and that a forced non-2xx response makes `curl` fail/retry. The workflow's manual dispatch calls production, so do not use it for synthetic test data; use staging `curl` for endpoint tests.
   - Apply migration 0016; change a phase, week, and topic using the admin UI, rerun the curriculum seed, and verify those edits remain. Then make another authenticated admin edit and confirm the guard does not block the app's normal update path.
   - Apply migration 0017; verify empty prerequisites are populated for untouched seeded topics, existing prerequisite values and admin-edited topics remain unchanged, and the UI displays the prerequisite guidance without locking progression.
   - Apply migration 0018; confirm each published seeded topic has a week-aligned resource, rerunning is idempotent, and existing administrator-added resources remain unchanged.
   - Apply migration 0019; perform one representative mutation for each audited workflow, inspect event type/actor/team, verify metadata contains no report/comment/feedback text, and confirm another team's leader cannot read the records.
9. Dashboard counts against known fixture records and empty states.
10. Direct Supabase API/RLS attempts for unauthorized cross-user and cross-role reads/writes.

Use synthetic records only. Do not use production member data for test fixtures. Record command output, environment (without secret values), account role, and any failures in `docs/FEATURE_COMPLETION_TRACKER.md`.

## Browser and responsive review

Check navigation and forms at narrow mobile, tablet and desktop widths. Confirm keyboard reachability, visible focus, labels, validation messages, empty/loading/error states, and browser console output. No browser-based evidence has yet been recorded for the current audit.
