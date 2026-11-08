# Security

The security reference for the Phase 1 + Phase 2 build. The migration (`supabase/migrations/0001_initial_schema.sql`) is the source of truth for every policy listed here.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server paths only — never imported into browser code, never re-exported from `src/lib/supabase/configured.ts`. Read directly from `process.env` where needed. RLS still applies when the publishable key is used; the service-role key bypasses RLS and is reserved for one-off bootstrap operations. | No |
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
| `profiles_select` | SELECT | `id = auth.uid()` OR (an active team member reading another active member's profile, via a self-join on `team_members`) | — | A user always reads their own profile. Active members can read other active members' profiles (the team directory). |
| `profiles_self_update` | UPDATE | `id = auth.uid()` | `id = auth.uid()` | A user may update only their own row, and the row must still be theirs after the update (prevents swapping the id). |
| `profiles_no_direct_insert` | INSERT | — | `false` | Direct inserts are blocked. Profiles are created only by the `handle_new_user` trigger. |

Note: `profiles` has no DELETE policy. The cascade from `auth.users` handles deletion; there is no client-initiated delete path.

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

`profiles_self_update` allows only `id = auth.uid()`. Role, email, and membership are not columns on `profiles` — they live on `team_members`. So even a successful profile update can change only `full_name`, `username`, `avatar_url`, `bio`, `github_username`, `github_profile_url`, and `timezone`. The Server Action `updateProfileAction` (`src/features/profile/actions.ts`) further restricts the editable set and rejects duplicate usernames (Postgres error code `23505`).

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

Storage is **not implemented in Phase 2**. Avatar uploads and submission file uploads arrive in later phases. The planned bucket policy from the spec (D7):

- `avatars` bucket: max 2 MB per file; allowed MIME `image/jpeg`, `image/png`, `image/webp`; public read, owner write. The URL is stored in `profiles.avatar_url`.
- `submissions` bucket: max 25 MB per file; allowed MIME whitelist (pdf, plain text, markdown, common image types, csv, json, zip, Jupyter notebook); private — signed URLs only.

Server-side MIME validation should use both `Content-Type` and magic-byte sniffing where feasible; client-side pre-checks are UX only and not a security boundary (FR-SEC.5, FR-SEC.6).

## Related requirements

| Requirement | Where it is satisfied |
|---|---|
| FR-SEC.1 RLS on every public table | All four Phase 2 tables have `enable row level security`. |
| FR-SEC.2 Publishable key in browser; service-role key server-only | See Key management above. |
| FR-SEC.3 Never trust client user IDs; use `auth.uid()` | Every policy and every helper function. |
| FR-SEC.4 Users cannot self-assign admin role | `team_members_admin_write` + `is_team_admin_of`. |
| FR-SEC.5/FR-SEC.6 Upload validation and private buckets | Not yet implemented — planned for the Storage phases (see [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)). |
| FR-SEC.7 Activity logs contain no secrets | Activity logs are not yet implemented; the rule will apply when they are added. |
| FR-A.8 Registration alone does not grant access | The membership gate above. |
| FR-A.10 Service-role key never in client code | See Key management above. |
