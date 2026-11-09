# Project architecture

## Runtime

Squad Hub uses Next.js App Router on Vercel and Supabase Auth/Postgres. Route components use Server Components for protected reads and Client Components for interactive forms. Feature code is grouped in `src/features`; server actions validate input with Zod and use a cookie-bound Supabase client so database RLS evaluates the signed-in user. Middleware refreshes the Supabase session. The service-role key is isolated in `src/lib/supabase/admin.ts` for privileged server-only Auth Admin operations.

## Main areas

- `src/app`: route handlers, layouts, pages and page-level components.
- `src/features`: auth, members, profile, roadmap, assignments, submissions, reports, discussions, blockers, announcements, notifications and progress.
- `src/lib/supabase`: browser, server, middleware and privileged clients.
- `supabase/migrations`: ordered schema, policies, triggers and curriculum seed.
- `supabase/seed`: bootstrap SQL for initial administrator setup.

## Data and access

Postgres is the source of truth. Each migration is additive/versioned; never rewrite an applied migration. Domain queries run under RLS, with server-side role checks as an additional boundary. `src/types/database.ts` is maintained application typing and must be reviewed against migrations after schema updates.

## Production constraints

Vercel hosts the app; Supabase provides Auth, database and private Storage policies. Profile avatars, submission attachments, assignment resources and blocker files are implemented in source. Auth email delivery depends on Supabase SMTP configuration and redirect allow-list. No GitHub API synchronization or scheduled job service is configured. Production database and Vercel settings must be verified in their dashboards; this repository audit does not prove which migrations have been applied.

For routes and the migration inventory, see [COMPLETION_AUDIT.md](./COMPLETION_AUDIT.md). For authorization, see [ROLE_PERMISSIONS.md](./ROLE_PERMISSIONS.md).
