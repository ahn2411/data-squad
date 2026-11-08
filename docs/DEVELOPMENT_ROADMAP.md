# Development roadmap

This document records the current implementation and the remaining setup work for Squad Hub.

## Delivered

### Foundation, authentication, and membership

- Next.js App Router, TypeScript, Tailwind, shared UI, themes, and responsive workspace shell.
- Supabase authentication, registration/password flows, active-membership gating, profiles, and member administration.
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

Apply migrations in order to the Supabase project used by the deployment. The migrations contain RLS policies and triggers; deploying only the frontend does not provision this schema or Storage buckets.

## Remaining work and external setup

- Create a private `submissions` Storage bucket and Storage policies before enabling file upload/download UI.
- Create an `avatars` bucket if profile image uploads are added.
- Configure Supabase Auth email delivery for password resets and invitation flows.
- Add realtime notification updates if live delivery is required; currently the UI refreshes data on requests.
- Build an admin settings page if application-level settings are needed.
- Run a production browser/accessibility review and deploy against the intended production Supabase project.

## Known scope boundaries

- GitHub profile, submission, and report links are stored as URLs; no GitHub API synchronization is implemented.
- Topic completion is member-driven and does not automatically infer completion from assignment status.
- Submission text and URL workflows work without Storage. The file metadata table alone does not provide object storage.
