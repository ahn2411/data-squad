# Security

> **Current status:** This document began as a Phase 1/2 security reference. The application now has migrations through `0028_curriculum_topic_exercises.sql`. Treat the historical per-policy catalog below as incomplete; current SQL migrations are authoritative. RLS and column grants have not yet been exercised with separate test accounts during this audit. Migrations 0008–0028 have not been applied to production as part of this work.

The scheduled reminder route is excluded from user-session middleware and requires an exact `Authorization: Bearer <CRON_SECRET>` match before creating any privileged Supabase client. Keep `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` server-only in Vercel settings. The route only selects active team members and uses a database unique key to make repeated job invocations idempotent; its live authorization and data-scope behavior still need runtime tests.

`/auth/callback` is intentionally public so Supabase can exchange an unauthenticated one-time PKCE code before a session exists. The callback validates its post-authentication `next` path and only exchanges the code through Supabase Auth. The proxy also forwards legacy root URLs containing an auth code to this handler before the protected-route gate runs. Keep the production Supabase Site URL and redirect allowlist pointed at the Vercel origin.

The SQL migration history is the source of truth for policies listed here. Migration 0024 pins `pg_catalog, public, pg_temp` for all `SECURITY DEFINER` routines in `public`, keeping built-ins first, application objects explicitly schema-scoped, and temporary objects last. Migration 0025 restricts review history to inserts, serializes review decisions on each submission, and enforces reviewability and score bounds in the database. Apply and inspect these migrations in a disposable project before production rollout; future definer functions should use an equally pinned path.

Notification destinations are database values and are treated as untrusted at navigation time. `safeInternalPath` rejects non-rooted, protocol-relative, backslash, and control-character paths before rendering links or calling `router.push`; the installed Next.js guidance specifically warns against sending unsanitized values to router navigation. Keep the same validation on any future database-backed navigation link.

Weekly reports are member-owned. Migration 0020 permits member edits for seven days after the latest save, sets submission timestamps in the database, and removes the member delete policy. Leaders/admins may update only `leader_feedback`; they cannot update member report content through the normal app policy. Activity-log rows are created by security-definer triggers, contain operation/status metadata only, and can be read only by team leaders/admins under the existing team-scoped RLS policy.

## Core principle

**RLS is the real authorization layer. UI button-hiding is NOT authorization** (FR-SEC). If a row is not visible through a policy, no client — including a hand-crafted `fetch` with the anon key — can read or mutate it. The app hides admin controls from non-admins purely for UX; the policies enforce the actual limits.

Two corollaries:

- **Never trust client-provided user IDs.** Every policy derives identity from `auth.uid()`. No policy reads a user id out of a request body or query string.
- **Never trust client-only validation.** Zod schemas run on both client and server, but the server re-parses in every Server Action and the database re-checks via RLS.

## Key management

Only two values are safe for the browser and are prefixed `NEXT_PUBLIC_`:

| Variable | Where it is used | Safe for browser |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All three Supabase clients. | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | All three Supabase clients (the anon/publishable key). | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server paths only — isolated in `src/lib/supabase/admin.ts` and used by Auth Admin invite operations. It bypasses RLS and must never enter browser code. | No |
| `NEXT_PUBLIC_SITE_URL` | Auth email redirect base URL. | Yes |

`src/lib/supabase/configured.ts` deliberately exposes only `url` and `anonKey`. The service-role key has no central accessor — it must be read from `process.env` in the specific server path that needs it, which keeps it out of accidental client bundles.

## RLS policies

RLS is enabled on all four Phase 2 tables:

```sql
alter table public.teams        enable row level security;
alter table public.profiles     enable row level security;
alter table public.team_members enable row level security;
alter table public.invitations  enable row level security;
```

The policies below are the exact ones from 0001.

### `teams`

| Policy | Op | `using` | `with check` | Plain English |
|---|---|---|---|---|
| `teams_select` | SELECT | `public.is_active_member_of(id)` | — | Only active members of a team can read that team. |
| `teams_admin_write` | ALL | `public.is_team_admin_of(id)` | `public.is_team_admin_of(id)` | Only active admins can insert, update, or delete a team (and the row must still satisfy the admin check after the write). |

### `profiles`

| Policy | Op | `using` | `with check` | Plain English |
|---|---|---|---|---|
| `profiles_select` | SELECT | `id = auth.uid()` OR (an active team member reading another active member's profile, via a self-join on `team_members`) | — | A user always reads their own profile. Active members can read other active members' profile rows. Column grants in migration 0027 independently limit accessible fields. |
| `profiles_self_update` | UPDATE | `id = auth.uid()` | `id = auth.uid()` | A user may update only their own row, and the row must still be theirs after the update (prevents swapping the id). |
| `profiles_no_direct_insert` | INSERT | — | `false` | Direct inserts are blocked. Profiles are created only by the `handle_new_user` trigger. |

Note: `profiles` has no DELETE policy. The cascade from `auth.users` handles deletion; there is no client-initiated delete path.

### Profile email/timezone source mitigation (database verification pending)

PostgreSQL RLS filters rows, not columns. Migration 0027 addresses that gap by revoking table-level profile grants, granting explicit columns that exclude email and timezone, and exposing only the caller's own timezone through a restricted security-definer function. Profile joins and search queries no longer request email. The migration is prepared but unapplied; until it is run and direct authenticated PostgREST checks confirm email/timezone denial and owner-only timezone access, production privacy remains unverified.

### `team_members`

| Policy | Op | `using` | `with check` | Plain English |
|---|---|---|---|---|
| `team_members_select` | SELECT | `public.is_team_leader_or_admin_of(team_id)` OR (`public.is_active_member_of(team_id)` AND `membership_status in ('active','pending_approval')`) | — | Leaders/admins see the full roster including suspended/removed rows. Active members see only active and pending_approval rows — they can tell who is waiting, but not who has been suspended or removed. |
| `team_members_admin_write` | ALL | `public.is_team_admin_of(team_id)` | `public.is_team_admin_of(team_id)` | Only active admins can insert, update, or delete membership rows. Leaders cannot. A member can never write their own membership because the check requires admin role. |

### `invitations`

| Policy | Op | `using` | `with check` | Plain English |
|---|---|---|---|---|
| `invitations_select` | SELECT | `public.is_team_leader_or_admin_of(team_id)` | — | Only leaders and admins can see invitations. Members cannot. |
| `invitations_leader_insert` | INSERT | — | `public.is_team_leader_or_admin_of(team_id)` AND `invited_by = auth.uid()` | Leaders and admins can create invitations, but the `invited_by` column must equal the caller — no forging the inviter. |
| `invitations_admin_update` | UPDATE | `public.is_team_admin_of(team_id)` | `public.is_team_admin_of(team_id)` | Only admins can update an invitation (e.g. mark accepted, revoked, expired). Leaders cannot. |
| `invitations_admin_delete` | DELETE | `public.is_team_admin_of(team_id)` | — | Only admins can delete invitations. |

## The membership gate

The gate is **two-step at the database level**:

1. A registered user has a `profiles` row but no `team_members` row → `is_active_member_of(...)` returns false → `teams_select` returns nothing, `team_members_select` returns nothing, `profiles_select` returns only their own row. They have no team context at all. The root resolver sends them to `/pending-approval`.
2. Even after a `team_members` row exists, only `membership_status='active'` passes `is_active_member_of`. `pending_invite`, `pending_approval`, `suspended`, and `removed` are all blocked at the DB level — they cannot read `teams`, they cannot read the full `team_members` roster (a pending user only sees their own pending row, not the active members — see denial test 3 below), and they cannot write any membership rows.

There is no client-side "active member" flag the user can flip. The status lives in a row they cannot write.

## Self-promotion prevention

`team_members` writes are admin-only via `is_team_admin_of(team_id)`, which requires an existing active admin membership for the caller. A user with no membership, a pending membership, or a member/leader role cannot:

- insert a `team_members` row for themselves,
- update their own `role` to `admin`,
- update their own `membership_status` to `active`,
- delete their own row to cover tracks.

The app also guards `.neq("user_id", admin.adminId)` on `suspendMemberAction`, `removeMemberAction`, and `changeRoleAction` (see `src/features/members/actions.ts`). This is defense-in-depth: even if an admin somehow targeted themselves, the query would match zero rows. The RLS policy is the real guarantee; the `.neq` filter is a second layer.

## Profile updates cannot escalate privileges

`profiles_self_update` allows only `id = auth.uid()`. Role and membership live on `team_members`, not `profiles`; email is stored on `profiles` but is excluded from authenticated column grants by migration 0027. The Server Action `updateProfileAction` (`src/features/profile/actions.ts`) limits the editable set to `full_name`, `username`, `avatar_url`, `bio`, `github_username`, `github_profile_url`, `capstone_repository_url`, and `timezone`, and rejects duplicate usernames (Postgres error code `23505`). Database column grants still need direct verification; do not rely on the Server Action as the only access control.

## How to test a denied RLS action

These recipes assume you have at least one admin and one regular `member` in the same team. Run them signed in as the member (or with the anon key in a script using the member's access token — the result is identical because RLS applies to the session).

1. **Self-promotion attempt.** Sign in as a Member. In the Supabase SQL editor (or via a script with the anon key):

   ```sql
   update public.team_members
     set role = 'admin'
     where user_id = '<your-own-user-id>';
   ```

   Expected: 0 rows updated (or an RLS error). `team_members_admin_write` requires `is_team_admin_of(team_id)`, which the caller is not.

2. **Self-activation attempt.** Same setup:

   ```sql
   update public.team_members
     set membership_status = 'active'
     where user_id = '<your-own-user-id>';
   ```

   Expected: 0 rows updated. Same policy, same denial.

3. **Pending member sees only their own row.** Sign in as a user whose `team_members` row is `pending_approval`. Query the roster:

   ```sql
   select user_id, role, membership_status from public.team_members;
   ```

   Expected: only the caller's own `pending_approval` row is returned, not the active members or any suspended/removed rows. `team_members_select` restricts non-leader/admin callers to rows where `membership_status in ('active','pending_approval')` AND the caller is an active member — a pending caller fails the active-member check, so they see only their own pending row (which satisfies `membership_status in ('active','pending_approval')`).

4. **Member cannot read invitations.** Sign in as a Member and run:

   ```sql
   select * from public.invitations;
   ```

   Expected: 0 rows. `invitations_select` requires `is_team_leader_or_admin_of(team_id)`.

5. **Member cannot read another team's `teams` row.** Sign in as a Member of team A. There is only one team at launch, but if a second team existed:

   ```sql
   select * from public.teams;
   ```

   Expected: only team A. `teams_select` requires `is_active_member_of(id)`.

6. **Profile id-swap attempt.** Sign in as a Member and try to update someone else's profile:

   ```sql
   update public.profiles
     set bio = 'pwned'
     where id = '<another-user-id>';
   ```

   Expected: 0 rows. `profiles_self_update` requires `id = auth.uid()` in both `using` and `with check`.

## Storage

Migration `0008_private_storage.sql` defines two private buckets. Profile avatar upload uses `squad-avatars`; allowed types are JPEG, PNG and WebP, with a 5 MB limit. `squad-attachments` allows a restricted document/image/archive MIME list with a 10 MB limit. Member submissions use `<team>/<member>/<submission>/<filename>`; assignment resources use `<team>/<manager>/assignments/<assignment>/<filename>`. Assignment reads additionally require `can_access_assignment`; only active leaders/admins can upload or remove assignment resources. Both buckets remain private. Migration 0011 adds assignment file metadata and narrows the assignment-specific Storage policy branch.

Profile, submission, assignment and blocker upload flows check MIME and size in the client; server actions verify object paths and compare Storage metadata before recording database metadata. These checks do not sniff file bytes. Magic-byte validation and end-to-end Storage policy tests remain outstanding. Review and test migrations 0008, 0011, 0012 and 0014 on a non-production Supabase project before production rollout. Migration 0013 additionally enforces configured topic completion criteria at the database boundary.

Storage limits and allowed MIME types are declared by migration 0008. Client and uploaded-object metadata checks are defense-in-depth, but neither proves the uploaded bytes match the claimed MIME type. Add byte-signature validation before allowing higher-risk file formats (FR-SEC.5, FR-SEC.6).

## Related requirements

| Requirement | Where it is satisfied |
|---|---|
| FR-SEC.1 RLS on every public table | All four Phase 2 tables have `enable row level security`. |
| FR-SEC.2 Publishable key in browser; service-role key server-only | See Key management above. |
| FR-SEC.3 Never trust client user IDs; use `auth.uid()` | Every policy and every helper function. |
| FR-SEC.4 Users cannot self-assign admin role | `team_members_admin_write` + `is_team_admin_of`. |
| FR-SEC.5/FR-SEC.6 Upload validation and private buckets | Partial: private buckets/policies and profile, submission, assignment, and blocker attachment flows exist; byte-level validation and runtime policy tests remain. |
| FR-SEC.7 Activity logs contain no secrets | Migration 0019 records operation/status metadata only; it excludes report contents, comments, feedback, and credentials. |
| FR-A.8 Registration alone does not grant access | The membership gate above. |
| FR-A.10 Service-role key never in client code | See Key management above. |
