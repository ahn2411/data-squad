# Development roadmap

This document records the current implementation and the remaining setup work for Squad Hub.

## Delivered

### Foundation, authentication, and membership

- Next.js App Router, TypeScript, Tailwind, shared UI, themes, and responsive workspace shell.
- Supabase authentication, registration/password flows, active-membership gating, profiles, and member administration.
- Signup, invite and password-reset emails share a validated callback URL; production rejects localhost and falls back to Vercel's production origin. `/auth/callback` passes the proxy auth gate, and root-level legacy PKCE links are forwarded to it. Supabase Site URL, redirect allowlist, and email templates remain external verification steps.
- Cookie-persisted sidebar collapse state and role-filtered navigation.

### Learning and progress

- `0002_roadmap.sql`: team settings, phases, weeks, topics, learning resources, topic progress, and RLS.
- Roadmap viewer and admin curriculum management; seeded curriculum is in `0005_curriculum_seed.sql`.
- Member and admin dashboards calculate progress from curriculum and activity records.

### Assignments and submissions

- `0003_assignments.sql`: assignments, recipients, submissions, revisions, file metadata, reviews, RLS, and integrity triggers.
- Member assignment/submission flows and admin assignment management.
- Leader/admin review actions and submission history.

### Collaboration and reporting

- `0004_collaboration.sql`: weekly reports, discussion threads/posts, blockers/comments, announcements, notifications, activity logs, and policies/triggers.
- Member reports, discussions, blockers, announcements, and notification center; leader/admin review and management views.
- `0005_curriculum_seed.sql`: repeatable curriculum seed data.

## Current migration sequence

| Migration | Scope |
|---|---|
| `0001_initial_schema.sql` | Teams, profiles, membership, invitations, and shared enums/helpers |
| `0002_roadmap.sql` | Team settings, curriculum, resources, and topic progress |
| `0003_assignments.sql` | Assignments, recipients, submissions, revisions, files, and reviews |
| `0004_collaboration.sql` | Reports, discussions, blockers, announcements, notifications, and activity logs |
| `0005_curriculum_seed.sql` | Idempotent curriculum seed |
| `0006_pending_member_notification_type.sql` | Notification type for pending member reviews |
| `0007_pending_member_review.sql` | Create pending memberships at signup, notify admins, and backfill existing profiles |
| `0008_private_storage.sql` | Private avatar and attachment buckets with team-scoped policies |
| `0009_notification_event_types.sql` | Notification enum values for submissions, discussion replies and blocker responses |
| `0010_collaboration_notifications.sql` | Event-driven notifications for submissions, replies and blocker changes |
| `0011_assignment_attachments.sql` | Assignment file metadata and access-controlled private Storage policies |
| `0012_blocker_resolution_files.sql` | Blocker files, private Storage access, and reporter close/reopen transitions |
| `0013_topic_completion_checklist.sql` | Criteria snapshots and database enforcement for topic completion |
| `0014_week_deliverable_progress.sql` | Per-learner weekly deliverable progress with RLS |
| `0015_notification_dedupe.sql` | Unique notification keys for retry-safe scheduled reminders |
| `0016_preserve_curriculum_edits.sql` | Prevent curriculum seed reruns from overwriting prior edits |
| `0017_curriculum_prerequisites.sql` | Fill missing prerequisite guidance on untouched seeded topics |

Apply migrations in order to the Supabase project used by the deployment. The migrations contain RLS policies and triggers; deploying only the frontend does not provision this schema or Storage buckets.

## Remaining work and external setup

- Apply migrations 0008–0021 to a disposable Supabase project and verify file access, RLS, status transitions, notification triggers/read states/pagination, topic/week completion checks, notification deduplication, curriculum edit/resource seeding, activity auditing, and weekly report edit locking before production rollout.
- Configure Supabase Auth email delivery for password resets and invitation flows.
- Add realtime notification updates if live delivery is required; currently the UI refreshes data on requests.
- Exercise report/deadline reminders and search coverage; add activity audit writers. Reminder generation uses a protected endpoint, twice-daily GitHub Actions schedule and database dedupe; runtime workflow verification remains.
- Run a production browser/accessibility review and verify the intended Vercel/Supabase deployment.

## Known scope boundaries

- GitHub profile, submission, and report links are stored as URLs; no GitHub API synchronization is implemented.
- Topic completion is member-confirmed against configured criteria and does not automatically infer completion from assignment status.
- Profile, submission, assignment, and blocker file flows use private Supabase Storage, but migration application and role-based runtime tests remain outstanding.
