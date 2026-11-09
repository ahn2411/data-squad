# Data Science Squad Hub

A private collaborative learning platform for a six-member Data Science squad — a full 24-week curriculum, assignments, submissions, peer review, progress tracking, weekly reports, discussions, blockers, announcements, and notifications, all backed by Supabase Postgres with Row-Level Security.

> From confused to competent.

This repository is an existing product under ongoing completion. See [the audit](docs/COMPLETION_AUDIT.md), [implementation roadmap](docs/IMPLEMENTATION_ROADMAP.md), and [feature tracker](docs/FEATURE_COMPLETION_TRACKER.md) for verified status and known gaps. A successful build does not mean production migrations, SMTP, or RLS behavior have been verified.

## Stack

- Next.js 16 (App Router, React 19 Server Components + Server Actions)
- TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (New York style) + Lucide icons
- React Hook Form + Zod (shared client/server validation)
- Recharts (charts, wired for later phases)
- Supabase via `@supabase/ssr` (Postgres, Auth, RLS, private Storage policy foundation)
- Vercel (deployment target)

## Prerequisites

- Node.js 20+
- The Supabase CLI: `npm i -g supabase`
- A Supabase project (create one at supabase.com, or run a local project with `supabase init` + `supabase start`)

## Quick start

1. Install dependencies:

   ```bash
   npm install
   # or
   bun install
   ```

2. Create a Supabase project at supabase.com (or `supabase init` + `supabase start` for a local project).

3. Copy the env template and fill in your Supabase credentials:

   ```bash
   cp .env.example .env.local
   ```

   Set these values from Supabase and your app origin:

   | Variable | Notes |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL, safe for the browser. |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The anon/publishable key, safe for the browser. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Never prefix with `NEXT_PUBLIC_`. Used by invitation Auth Admin operations. |
   | `NEXT_PUBLIC_SITE_URL` | Canonical app origin for auth emails. Local dev: `http://localhost:3000`; production: the HTTPS Vercel domain. Production Vercel can fall back to its system production domain and will not send localhost links. |

4. Inspect and apply the migrations (run them in order). For a linked project, first confirm its project reference and whether it is development or production:

   ```bash
   supabase db push
   ```

   Or open the Supabase SQL editor and run each file in `supabase/migrations/` in numeric order (`0001` → `0028`). They build the current schema:
   - `0001_initial_schema.sql` — teams, profiles, team_members, invitations + enums + RLS helpers
   - `0002_roadmap.sql` — phases, weeks, topics, learning_resources, topic_progress, team_settings + RLS
   - `0003_assignments.sql` — assignments, recipients, submissions, revisions, files, reviews + RLS + self-review guard
   - `0004_collaboration.sql` — weekly_reports, discussions, blockers, announcements, notifications, activity_logs + RLS + notification triggers
   - `0005_curriculum_seed.sql` — 24-week curriculum (6 phases, 24 weeks, 83 topics, and core resource links); idempotent.
   - `0006_pending_member_notification_type.sql` and `0007_pending_member_review.sql` — pending member review notification and signup membership flow.
   - `0008_private_storage.sql` — private team-scoped avatar and attachment buckets/policies. Profile avatar and submission attachment flows are implemented.
   - `0009_notification_event_types.sql` and `0010_collaboration_notifications.sql` — submission, discussion-reply, and blocker event notifications.
   - `0011_assignment_attachments.sql` — private assignment file metadata and assignment-aware Storage access policies.
   - `0012_blocker_resolution_files.sql` — blocker close/reopen transitions, private screenshot/file metadata, and team-scoped Storage access.
   - `0013_topic_completion_checklist.sql` — persists criteria snapshots and prevents unqualified topic completion.
   - `0014_week_deliverable_progress.sql` — persists weekly deliverable and completion-criteria progress with member-scoped RLS.
   - `0015_notification_dedupe.sql` — adds idempotency keys for scheduled reminder notifications.
   - `0016_preserve_curriculum_edits.sql` — protects administrator-edited curriculum rows from rerun seed updates.
   - `0017_curriculum_prerequisites.sql` — fills missing prerequisites on untouched seeded topics without changing authored values.
   - `0018_curriculum_topic_resources.sql` — attaches free, week-aligned learning references to published topics without replacing existing links.
   - `0019_activity_audit_triggers.sql` — records privacy-minimal team activity for important member and collaboration changes.
   - `0020_weekly_report_edit_window.sql` — enforces a seven-day member report edit window and prevents member deletion of report history.
   - `0021_notifications_page_index.sql` — indexes the notification center's user/read/time pagination order.
   - `0022_submissions_history_index.sql` — indexes stable newest-first member submission history pagination.
   - `0023_assignment_notification_recipient_scope.sql` — repairs publish notifications to honor selected active recipients.
   - `0024_harden_definer_search_paths.sql` — pins search paths for public SECURITY DEFINER routines.
   - `0025_review_integrity.sql` — makes reviews append-only and validates reviewable submission states and score bounds.
   - `0026_capstone_repository_link.sql` — adds a validated capstone repository URL to the existing member profile.
   - `0027_protect_profile_email.sql` — limits authenticated profile columns and exposes the caller's timezone through an owner-only function. Apply this before deploying code that calls the function.
   - `0028_curriculum_topic_exercises.sql` — adds phase-appropriate instructions and deliverables to unchanged seeded topic exercises, preserving administrator-edited exercise text.

5. Regenerate and review TypeScript database types after schema changes:

   ```bash
   SUPABASE_PROJECT_REF=<your-project-ref> npm run supabase:types
   ```

   This runs the Supabase type generator. Review generated diffs before committing.

6. Start the dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. Without env vars set, the app renders a "Supabase is not configured" screen instead of crashing.

## Bootstrap the first admin

A freshly registered user has a `profiles` row but no `team_members` row, so they cannot see the workspace. Bootstrap the first admin manually (this script runs as `postgres` and bypasses RLS):

1. Register at `/register` with your email. This creates an `auth.users` row and, via the `on_auth_user_created` trigger, a matching `profiles` row.
2. Open `supabase/seed/bootstrap-admin.sql` and replace `YOUR_EMAIL@example.com` with the email you registered with.
3. Paste the edited script into the Supabase SQL editor and run it. It is idempotent: it creates the launch team `Data Science Squad` (slug `data-science-squad`) and grants your profile an active `admin` membership.
4. Run `supabase/seed/weekly-assignments.sql` in the Supabase SQL editor. It creates one assignment draft for each curriculum week that has no assignment yet. Review the drafts in `/admin/assignments`, set deadlines as appropriate, and publish them when ready. Drafts do not notify members; publishing uses the normal assignment workflow.
5. Log in at `/login`. You should land on `/dashboard`.

## Creating the other 5 members

After the admin is bootstrapped and signed in, go to `/admin/members`. There are two paths:

- **Registration + admin approval (default).** Each member registers at `/register`. Their `team_members` row is created with `membership_status='pending_approval'`. The admin approves them in the members table, which flips the status to `active`. Registration alone does NOT grant access — admin approval is required (FR-A.8).
- **Invite flow.** An admin can send a Supabase Auth invite to a member or leader. The recipient follows the email callback and still requires admin approval before workspace access. This requires the server-only service role key, working Supabase email delivery, and the production callback URL in Supabase's redirect allow-list.

A pending member sees the `/pending-approval` screen. A suspended member sees it with `?reason=suspended`; a removed member sees it with `?reason=removed`.

## Email confirmation

Email delivery is handled by Supabase Auth. Confirmation behavior depends on the project's Auth settings. Admin approval remains the gate that grants workspace access. Invite and recovery redirect URLs must be allow-listed in Supabase. The default email provider may rate-limit repeated sends; configure custom SMTP for reliable production delivery.

## Deploy to Vercel

1. Push the repo to GitHub/GitLab and import it into Vercel.
2. Add the required environment variables from `.env.example` in the Vercel project settings, including a strong `CRON_SECRET` for the scheduled reminder job.
3. Point Vercel at the intended Supabase project. Review and apply all migrations (`0001`–`0028`) using the deployment guide, without resetting the database. Apply schema changes before deploying code that depends on them.
4. Bootstrap the first admin against the production database using `supabase/seed/bootstrap-admin.sql`, then run `supabase/seed/weekly-assignments.sql` if the team does not already have weekly assignments. This additive seed creates drafts only for weeks with no assignments.
5. Deploy. The build uses `next build`; no special build step is required.

## Project structure

The app is a Next.js App Router project with feature modules under `src/features`, browser/server/middleware/Admin Supabase clients in `src/lib/supabase/`, and a `(app)` route group gated by `requireActiveMember`. `src/types/database.ts` is maintained application typing and should be compared with generated types after schema changes. See `docs/PROJECT_ARCHITECTURE.md` and `docs/FEATURE_COMPLETION_TRACKER.md` for current structure and status.

## Documentation

| Document | Contents |
|---|---|
| `docs/PROJECT_ARCHITECTURE.md` | Current runtime, feature organization, data flow, and external setup. |
| `docs/DATABASE_SCHEMA.md` | Migration inventory and core data relationships. |
| `docs/ROLE_PERMISSIONS.md` | Role matrix and remaining RLS verification. |
| `docs/LEARNING_CURRICULUM.md` | Curriculum structure, seed and link verification. |
| `docs/DEPLOYMENT_GUIDE.md` | Environment, Auth, migration, and Vercel deployment notes. |
| `docs/TESTING_GUIDE.md` | Current checks and workflow/RLS test plan. |
| `docs/COMPLETION_AUDIT.md` | Repository audit and honest verification boundaries. |
| `docs/IMPLEMENTATION_ROADMAP.md` | Dependency-ordered completion tasks. |
| `docs/FEATURE_COMPLETION_TRACKER.md` | Persistent status and verification evidence. |
| `docs/SECURITY.md` | RLS as the authorization layer, key management, per-table policies, the membership gate, denial-test recipes. |
| `docs/DEVELOPMENT_ROADMAP.md` | Phase plan with migrations and tables per phase. |
| `docs/IMPLEMENTATION_CHECKLIST.md` | Historical checklist; current feature status is tracked in `FEATURE_COMPLETION_TRACKER.md`. |

## Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server on port 3000. |
| `npm run build` | Production build. |
| `npm run start` | Run the production build. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run supabase:types` | Regenerate `src/types/database.ts` from the linked Supabase project. |
