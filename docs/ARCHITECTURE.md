# Architecture

Squad Hub is a Next.js App Router application backed by Supabase Auth and Postgres. The initial foundation and membership flows are in place, along with the roadmap, assignment/review, progress, reporting, discussion, blocker, announcement, and notification features.

## Project layout

```text
src/
├── app/                 # routes, layouts, and page-level UI
│   └── (app)/            # authenticated workspace and admin routes
├── components/           # shared shell, navigation, brand, and UI primitives
├── features/             # domain actions, queries, and schemas
├── hooks/                # shared client hooks
├── lib/supabase/         # browser/server clients and session middleware
├── middleware.ts         # refreshes Supabase sessions
└── types/database.ts     # TypeScript database model
supabase/
├── migrations/           # ordered schema, RLS, trigger, and seed migrations
└── seed/                 # bootstrap admin SQL
```

Feature modules are grouped under `src/features`: auth, members, profile, roadmap, assignments, submissions, progress, reports, discussions, blockers, announcements, and notifications. Server Actions validate input and perform mutations; queries use the server Supabase client so database RLS sees the signed-in user.

## Authentication and authorization

`src/features/auth/session.ts` resolves the signed-in user and active team membership. The `(app)` layout calls `requireActiveMember()` before rendering workspace pages and filters navigation by role. Admin pages and mutations perform role checks in addition to database RLS.

The browser and server Supabase clients use the public publishable key. The server client is bound to request cookies. The service-role key must remain server-only and is used only in privileged server paths. Row-level security is the database authorization boundary; UI visibility is not a substitute for RLS.

## Routes and feature areas

- Authentication: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/pending-approval`.
- Workspace: `/dashboard`, `/profile`, `/roadmap`, `/assignments`, `/submissions`, `/weekly-reports`, `/discussions`, `/blockers`, `/announcements`, `/notifications`.
- Administration: `/admin/members`, `/admin/roadmap`, `/admin/assignments`, `/admin/announcements`.

The sidebar uses a server-provided collapsed state stored in a cookie, so its initial width is stable during route navigation. Desktop content and sidebar use a flex layout; the mobile navigation renders separately as a sheet. The shell also loads notification count and recent items for the bell.

## Database

Migrations run in order from `0001_initial_schema.sql` through `0005_curriculum_seed.sql`. They define membership, curriculum, assignments and submissions, collaboration/reporting, and seeded curriculum data. RLS policies scope records to active memberships and ownership/roles. Triggers enforce invariants that policies alone cannot safely express, including immutable submission identity, late status, review outcomes, and non-self-review.

Apply migrations to the intended Supabase project before deploying the app. `src/types/database.ts` is the application type model; regenerate it from the target project when the schema changes, then review generated changes against the codebase.

## Known external setup and limitations

- Submission file metadata is supported, but actual upload/download requires a private `submissions` Storage bucket and matching Storage policies.
- Avatar uploads require an `avatars` bucket; initials are shown without one.
- Password reset and invite email delivery depend on Supabase Auth email configuration.
- Notifications are loaded on page requests; realtime delivery is not wired.
- GitHub usernames and URLs are stored as profile/submission/report links; there is no GitHub API sync or separate GitHub page.
- Admin application settings are not implemented.
