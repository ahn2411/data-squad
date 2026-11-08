# Development roadmap

A phased plan for Data Science Squad Hub. Phases 1 and 2 are shipped against the actual codebase. Phases 3 through 8 are planned but not built — each entry lists the migration file it would add, the new tables/enums it would introduce, and which functional requirements it satisfies.

## Phase 1 — Foundation (DONE)

Delivered the project scaffold and the design system. Concretely:

- Next.js 16 App Router project with TypeScript strict, Tailwind CSS v4, shadcn/ui (New York), Lucide icons, React Hook Form, Zod, Recharts, `@supabase/ssr`.
- Design tokens in `src/app/globals.css`: one navy primary (`oklch(0.35 0.105 262)`), one teal accent (`oklch(0.6 0.118 184)`), slate neutrals, oklch CSS variables, light/dark via `next-themes`, 8px controls / 12px containers, Inter + JetBrains Mono.
- Root layout (`src/app/layout.tsx`) wiring fonts, `ThemeProvider`, and the `Toaster`.
- `src/lib/supabase/{client,server,middleware,configured}.ts` with `isSupabaseConfigured()` graceful degradation.
- `src/middleware.ts` session refresh + route protection.
- shadcn/ui primitives in `src/components/ui/`, the `AppShell` and sidebar scaffolding in `src/components/layout/`, the `NotConfiguredScreen`, `PageHeader`, `StatusPill` (RoleBadge + MembershipBadge), theme toggle, brand logo.
- The hand-written `src/types/database.ts` mirroring the Phase 1+2 schema.

Satisfies: foundational architecture (spec §7), design system (FR-UI.5).

## Phase 2 — Authentication + Members (DONE)

Delivered auth, the membership lifecycle, and the first app pages. Migration: `supabase/migrations/0001_initial_schema.sql` (already applied). Tables added: `teams`, `profiles`, `team_members`, `invitations`. Enums used: `team_role`, `membership_status`, `invitation_status`. Helper functions: `current_team_id`, `is_active_member_of`, `is_team_admin_of`, `is_team_leader_or_admin_of`. Triggers: `handle_new_user`, `set_updated_at`. RLS enabled on all four tables.

Code delivered:

- `src/features/auth/{actions,schemas,session}.ts` — `signInAction`, `signUpAction`, `requestPasswordResetAction`, `updatePasswordAction`, `signOutAction`; `getSessionContext()` typed union; `requireActiveMember()` and `requireRole()` guards.
- `src/features/members/{actions,queries,schemas}.ts` — approve, suspend, reinstate, remove, change role, invite; `getMembers()` query.
- `src/features/profile/{actions,schemas}.ts` — `updateProfileAction` with the editable-field whitelist.
- Pages: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/pending-approval`, `/dashboard`, `/profile`, `/admin/members`. The root `/` resolver routes by session state. The `(app)` layout gates on `requireActiveMember()`.
- Bootstrap script `supabase/seed/bootstrap-admin.sql` for the first admin.

Satisfies: FR-A.1 through FR-A.5, FR-A.7, FR-A.8, FR-A.9, FR-A.10, FR-SEC.1 through FR-SEC.4, FR-UI.1 through FR-UI.4 (shell + nav), the member-management half of FR-D.

## Phase 3 — Learning roadmap + member dashboard (PLANNED)

Migration: `0002_roadmap.sql`. New tables: `phases`, `weeks`, `topics`, `resources` (learning materials), `topic_progress`. Uses the already-declared enums `phase_status`, `week_status`, `topic_status`, `topic_difficulty`, `resource_type`.

- `phases`: id, ordinal (1–6), title, description, status (`phase_status`), start/end hints, timestamps.
- `weeks`: id, phase_id FK, ordinal (1–4 within phase), title, objective, status (`week_status`), timestamps.
- `topics`: id, week_id FK, title, description, learning objectives, estimated completion time, status (`topic_status`), difficulty (`topic_difficulty`), timestamps.
- `resources`: id, topic_id FK, title, url, type (`resource_type`), timestamps.
- `topic_progress`: id, topic_id FK, user_id FK → profiles, status, completed_at, timestamps. Unique `(topic_id, user_id)`.

Pages: `/roadmap` (browse phases → weeks → topics → resources), per-topic detail, and a real member `/dashboard` (FR-D.1: current phase/week, weekly objective, quick roadmap access). RLS: active members read published phases/weeks/topics/resources; members write only their own `topic_progress` rows.

Satisfies: FR-R.1 through FR-R.4, FR-D.1.

## Phase 4 — Assignments + submissions + reviews (PLANNED)

Migration: `0003_assignments.sql`. New tables: `assignments`, `task_assignments` (per-member assignment rows), `submissions`, `submission_files`, `reviews`, `submission_revisions`. Uses `assignment_type`, `assignment_difficulty`, `submission_type`, `submission_status`, `review_status`.

- `assignments`: id, title, description, instructions, phase_id FK, week_id FK (nullable), topic_id FK (nullable), difficulty, deadline (`timestamptz`, timezone-aware), max_score (nullable), required_submission_type, publication_status, created_by FK → profiles, timestamps.
- `task_assignments`: id, assignment_id FK, user_id FK → profiles, assigned_at, timestamps. The row that makes an assignment "show up" for a member.
- `submissions`: id, task_assignment_id FK, user_id FK → profiles, submission_type, submission_text, external_url, status (`submission_status`), is_late (bool), submitted_at, timestamps. Members edit only their own; approved rows are immutable.
- `submission_files`: id, submission_id FK, storage_path, file_name, mime, size_bytes, timestamps. Backed by the private `submissions` Storage bucket (signed URLs only).
- `reviews`: id, submission_id FK, reviewer_id FK → profiles, status (`review_status`), feedback, reviewed_at, timestamps.
- `submission_revisions`: id, submission_id FK, revision_number, snapshot of edited fields, created_at. Appends a new revision rather than overwriting (D7 proposal).

Storage buckets created in this phase: `submissions` (25 MB cap, private, signed URLs only).

Pages: `/assignments`, `/submissions`, per-assignment and per-submission detail, reviewer actions (approve / request revision).

Satisfies: FR-AS.1 through FR-AS.10, FR-S.*, US-AS.1 through US-AS.5, FR-SEC.5, FR-SEC.6 (for submission uploads).

## Phase 5 — Progress tracking + dashboards (PLANNED)

Migration: `0004_progress.sql`. No new tables — adds three database views and the Recharts dashboards that consume them.

- `individual_progress` view: per user — completed_topics / total_published_required_topics, completed_assignments / total_assigned, approved_submissions / total_submissions, sum of reported study hours.
- `team_progress` view: average of `individual_progress` across active members, plus weekly completion rate.
- `overdue_assignments` view: `task_assignments` whose deadline has passed and whose submission is missing or not approved.

Pages: enhanced `/dashboard` with Recharts charts (navy/teal/slate palette from `globals.css`), a `/team` view for leaders (FR-D.2), an admin overview (FR-D.3). All stats are derived from recorded activity — never manually editable (FR-D.4).

Satisfies: FR-D.2, FR-D.3, FR-D.4, US-P.1, US-P.2, US-P.3.

## Phase 6 — Weekly reports + blockers + announcements + notifications (PLANNED)

Migration: `0005_reports.sql`. New tables: `weekly_reports`, `learning_blockers`, `announcements`, `notifications`, `activity_logs`. Uses `blocker_priority`, `blocker_status`, `publication_status`, `notification_type`. Includes triggers that fire `notifications` rows on assignment/review/report events.

- `weekly_reports`: id, user_id FK, week_id FK, study_hours, summary, plans, timestamps. Unique `(user_id, week_id)` to block duplicate reports.
- `learning_blockers`: id, user_id FK, title, description, priority (`blocker_priority`), status (`blocker_status`), assigned_to FK (nullable), resolved_at, timestamps.
- `announcements`: id, author_id FK, title, body, status (`publication_status`), timestamps.
- `notifications`: id, user_id FK, type (`notification_type`), payload jsonb, read_at, timestamps.
- `activity_logs`: id, actor_id FK (nullable), action, target_type, target_id, metadata jsonb, created_at. Must never contain passwords, tokens, or secrets (FR-SEC.7).

Pages: `/weekly-reports`, `/blockers`, `/admin/announcements`. Notification bell in the shell.

Satisfies: weekly-report US-*, US-B.1 through US-B.3, the announcement/notification goals.

## Phase 7 — Discussions + GitHub profile links + avatar uploads (PLANNED)

Migration: `0006_collab.sql`. New tables: `discussions`, `discussion_posts` (or a single threaded table). Uses `publication_status` (re-used) or a new enum if needed.

- `discussions` / posts: id, author_id FK, topic_id FK (nullable, for topic-scoped threads), title, body, parent_id (nullable, for replies), status, timestamps. RLS: active members read and post; authors edit their own.
- GitHub profile links: `profiles.github_username` and `profiles.github_profile_url` already exist from Phase 2 — this phase adds a `/github` page that surfaces them (read-only, store-only; no GitHub API sync).
- Avatar uploads: `avatars` Storage bucket (2 MB cap, public read, owner write). `updateProfileAction` extended to accept an uploaded `avatar_url`.

Pages: `/discussions`, `/github`, avatar upload in `/profile`.

Satisfies: US-P.2, the collaboration goals (discussions), the GitHub profile goal.

## Phase 8 — Polish, command palette, accessibility, deployment (PLANNED)

Migration: none (or a small `0007_polish.sql` for indexes/materialized views if the dashboards need it).

- Command palette (the `cmdk` dependency is already installed) for quick navigation.
- Accessibility audit: keyboard navigation across all flows, focus traps on dialogs, ARIA labels on icon buttons, color-contrast verification for both themes.
- Performance pass: per-route Suspense boundaries, prefetching on nav links, image optimization for avatars.
- Production deployment to Vercel against the production Supabase project (see README → Deploy to Vercel).
- Definition of Done checklist (DoD.1 through DoD.13) walkthrough against the live app.

Satisfies: DoD.1 through DoD.13, FR-UI.* polish items.

## Migration sequence (planned)

| Phase | Migration | New tables | New views / buckets |
|---|---|---|---|
| 1 | — (scaffold) | — | — |
| 2 | `0001_initial_schema.sql` (done) | teams, profiles, team_members, invitations | — |
| 3 | `0002_roadmap.sql` | phases, weeks, topics, resources, topic_progress | — |
| 4 | `0003_assignments.sql` | assignments, task_assignments, submissions, submission_files, reviews, submission_revisions | `submissions` Storage bucket |
| 5 | `0004_progress.sql` | — | `individual_progress`, `team_progress`, `overdue_assignments` views |
| 6 | `0005_reports.sql` | weekly_reports, learning_blockers, announcements, notifications, activity_logs | — |
| 7 | `0006_collab.sql` | discussions (+ posts) | `avatars` Storage bucket |
| 8 | (none, or `0007_polish.sql`) | — | possible materialized views for dashboards |

All future enums are already declared in 0001, so adding these tables will not change the generated TypeScript types for the Phase 2 tables — codegen stays stable across migrations.
