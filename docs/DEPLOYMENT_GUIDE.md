# Deployment guide

## Environment

Configure the variables in `.env.example` in local development and the Vercel project settings. Never commit `.env` or expose a server secret with a `NEXT_PUBLIC_` prefix.

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: browser-safe Supabase publishable/anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used for Auth Admin invite operations; keep secret and restrict access.
- `NEXT_PUBLIC_SITE_URL`: canonical app origin, e.g. `https://data-squad-cyan.vercel.app`. In production, the auth redirect helper rejects localhost/insecure origins and falls back to Vercel's `VERCEL_PROJECT_PRODUCTION_URL`; in local development it defaults to `http://localhost:3000`.

## Supabase Auth

In Supabase Dashboard → Authentication → URL Configuration, set **Site URL** to `https://data-squad-cyan.vercel.app` and add `https://data-squad-cyan.vercel.app/**` to **Redirect URLs**. Keep `http://localhost:3000/**` only as an additional local-development entry; it must not be the remote project's Site URL. In Vercel, set `NEXT_PUBLIC_SITE_URL=https://data-squad-cyan.vercel.app` for Production and redeploy after changing it.

The Confirm signup, Invite user, and Reset password email templates should link through Supabase's `{{ .ConfirmationURL }}` so the `redirectTo` supplied by the app is honored. A custom template that directly builds a URL from `{{ .SiteURL }}` can bypass that redirect and send users to localhost. If you construct a custom token-hash confirmation link instead, it must target an implemented and tested token-verification route; this project currently uses `/auth/callback` for the PKCE `code` flow. Configure custom SMTP for reliable delivery; the default email provider can rate-limit requests. Test invites, confirmations, and recovery links with a non-production account before rollout.

## Database

Review migrations sequentially in `supabase/migrations`. For a linked project, inspect migration status first, review SQL, then apply with `npx supabase db push --linked` only after confirming the project reference and taking a backup. Never run `db reset` against production. This repository audit did not apply migrations to the remote project.

Do not infer that migrations `0008`–`0028` are deployed from their presence in Git. In the current audit, `supabase migration list --linked` required an unavailable Supabase access token, and a read-only query through the local `DIRECT_URL` was rejected by PostgreSQL authentication. A credentialed project owner must confirm migration history and Storage configuration before rollout. Migration 0027 changes profile column grants and adds an owner-only timezone RPC; apply and verify it before deploying the corresponding application code. Migration 0028 adds content only to unchanged seeded exercises. The source-only safety scan found no table drops, truncation, row deletion statements, or column drops in `0008`–`0028`; it does not verify executed DDL, RLS, or existing production data.

## Vercel

Connect the intended GitHub repository/branch, configure the environment variables for each environment, and use `npm run build` as the build command. Check build logs after deployment and perform a smoke test for login, pending approval, a protected page, and a database-backed list. A successful frontend build does not prove that remote migrations or SMTP are configured.

Migrations `0008`–`0028` provision private Storage policies, event notifications, assignment resources, blocker attachments, learning progress enforcement, notification deduplication and indexing, curriculum edit preservation and resources, privacy-minimal activity auditing, weekly report edit locking, submission-history pagination indexing, recipient-scoped assignment publish notifications, pinned search paths for public `SECURITY DEFINER` functions, append-only review integrity, capstone links, profile email/timezone column privacy, and guided instructions for seeded topic exercises. Profile avatars, submissions, assignment resources and blocker screenshots use the private bucket. Test uploads, signed downloads, blocker close/reopen transitions, topic criteria enforcement, week deliverables, notification triggers/read states/pagination, deduplication, report edit cutoff, activity logging, capstone link validation, concurrent review decisions, review immutability, profile column denial, timezone RPC ownership, curriculum migration edit preservation, and role-denial behavior in a non-production Supabase project before rollout.

Set `CRON_SECRET` to a strong random value in Vercel. `vercel.json` schedules `/api/cron/reminders` at 00:00 and 12:00 UTC on production deployments. Vercel sends the secret as a bearer token; the route rejects requests without the matching `Authorization` header. Two daily runs let weekday reminders honor team-local timezones across the UTC date boundary. Test the route with seeded non-production assignment/report data. Apply migration 0015 before enabling reminders; its unique `dedupe_key` prevents duplicate notifications on repeated invocations.

After applying curriculum migrations and bootstrapping the first active admin, run `supabase/seed/weekly-assignments.sql` in the SQL editor. It inserts only missing per-week assignment drafts, preserves existing assignments and submissions, and does not generate member notifications until an admin or leader reviews and publishes each draft.
