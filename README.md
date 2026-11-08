# Data Science Squad Hub

A private collaborative learning platform for a six-member Data Science squad — a full 24-week curriculum, assignments, submissions, peer review, progress tracking, weekly reports, discussions, blockers, announcements, and notifications, all backed by Supabase Postgres with Row-Level Security.

> From confused to competent.

## Stack

- Next.js 16 (App Router, React 19 Server Components + Server Actions)
- TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (New York style) + Lucide icons
- React Hook Form + Zod (shared client/server validation)
- Recharts (charts, wired for later phases)
- Supabase via `@supabase/ssr` (Postgres, Auth, RLS, future Storage)
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

   Set these four values (all four come from Supabase Dashboard → Settings → API):

   | Variable | Notes |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL, safe for the browser. |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The anon/publishable key, safe for the browser. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Never prefix with `NEXT_PUBLIC_`. Used only for privileged bootstrap paths. |
   | `NEXT_PUBLIC_SITE_URL` | The app base URL used for auth email redirects. Local dev: `http://localhost:3000`. |

4. Apply the migrations (run them in order). For a linked project:

   ```bash
   supabase db push
   ```

   Or open the Supabase SQL editor and run each file in `supabase/migrations/` in numeric order (`0001` → `0005`). They build the full schema:
   - `0001_initial_schema.sql` — teams, profiles, team_members, invitations + enums + RLS helpers
   - `0002_roadmap.sql` — phases, weeks, topics, learning_resources, topic_progress, team_settings + RLS
   - `0003_assignments.sql` — assignments, recipients, submissions, revisions, files, reviews + RLS + self-review guard
   - `0004_collaboration.sql` — weekly_reports, discussions, blockers, announcements, notifications, activity_logs + RLS + notification triggers
   - `0005_curriculum_seed.sql` — the full 24-week curriculum (6 phases, 24 weeks, 83 topics, 12 real resources). Idempotent; re-running updates content in place.

5. Generate the authoritative TypeScript types (the hand-written `src/types/database.ts` is a placeholder; replace it with the real generated types):

   ```bash
   SUPABASE_PROJECT_REF=<your-project-ref> npm run supabase:types
   ```

   This runs `supabase gen types typescript --project-id $SUPABASE_PROJECT_REF > src/types/database.ts`.

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
4. Log in at `/login`. You should land on `/dashboard`.

## Creating the other 5 members

After the admin is bootstrapped and signed in, go to `/admin/members`. There are two paths:

- **Registration + admin approval (default).** Each member registers at `/register`. Their `team_members` row is created with `membership_status='pending_approval'`. The admin approves them in the members table, which flips the status to `active`. Registration alone does NOT grant access — admin approval is required (FR-A.8).
- **Invite flow.** The admin uses the invite form on `/admin/members` to create an `invitations` row. The `invitations` table exists in Phase 2 and the insert path works; full invite-email delivery is a later phase, so today you must share the registration URL out of band.

A pending member sees the `/pending-approval` screen. A suspended member sees it with `?reason=suspended`; a removed member sees it with `?reason=removed`.

## Email confirmation

Email confirmation is **disabled by default**. Admin approval is the gate that actually grants workspace access, so requiring an email-confirmation step as well only adds friction during onboarding. To enable it, open Supabase Dashboard → Authentication → Settings and flip `enable_confirmations` on. With confirmation enabled, `signUpAction` returns the user to `/` and the root resolver sends them to `/pending-approval` until they click the link and an admin approves them.

## Deploy to Vercel

1. Push the repo to GitHub/GitLab and import it into Vercel.
2. Add the same four env vars from `.env.example` in the Vercel project settings.
3. Point Vercel at your **production** Supabase project (separate from the dev project). Apply all migrations (`0001`–`0005`) against it: `supabase db push` (with the production project linked) or paste each SQL file into the production SQL editor in order. Then run `supabase/seed/bootstrap-admin.sql`.
4. Bootstrap the first admin against the production database using `supabase/seed/bootstrap-admin.sql`.
5. Deploy. The build uses `next build`; no special build step is required.

## Project structure

The app is a Next.js 16 App Router project with a feature-based `src/features/{auth,members,profile,roadmap,assignments,submissions,progress,reports,discussions,blockers,announcements,notifications}` layout, three Supabase clients in `src/lib/supabase/` (browser, server, middleware), a `(app)` route group gated by `requireActiveMember`, and standalone auth pages. The hand-written `src/types/database.ts` mirrors the full schema (migrations 0001–0004) and is meant to be replaced by generated types. See `docs/ARCHITECTURE.md` for the full tree, the client pattern, routing, and the session model, and `docs/IMPLEMENTATION_CHECKLIST.md` for the per-feature status.

## Documentation

| Document | Contents |
|---|---|
| `docs/ARCHITECTURE.md` | Folder structure, Supabase client pattern, routing, Server Actions vs client components, session model, design tokens. |
| `docs/DATABASE_SCHEMA.md` | Tables, columns, constraints, enums, triggers, helper functions, and relationships. |
| `docs/SECURITY.md` | RLS as the authorization layer, key management, per-table policies, the membership gate, denial-test recipes. |
| `docs/DEVELOPMENT_ROADMAP.md` | Phase plan with migrations and tables per phase. |
| `docs/IMPLEMENTATION_CHECKLIST.md` | Audit findings + per-feature status (done/partial/not-started) + known limitations. |

## Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server on port 3000. |
| `npm run build` | Production build. |
| `npm run start` | Run the production build. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run supabase:types` | Regenerate `src/types/database.ts` from the linked Supabase project. |
