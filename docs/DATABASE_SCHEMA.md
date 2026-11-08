# Database schema

The Phase 1 + Phase 2 schema is defined entirely in `supabase/migrations/0001_initial_schema.sql`. That file is the source of truth — this document describes it. Future-phase tables (phases, weeks, topics, assignments, submissions, etc.) arrive in later migrations and are NOT in 0001.

The full D8 enum set is declared up front in 0001 so that codegen stays stable across migrations. Only `team_role`, `membership_status`, and `invitation_status` are used by Phase 2 tables; the rest are declared for forward compatibility and listed at the end of this document.

## Tables

### `teams`

The launch team. There is a single team at launch; `current_team_id()` returns its id (oldest by `created_at`).

| Column | Type | Constraints / default |
|---|---|---|
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `name` | `text` | `not null` |
| `slug` | `text` | `not null`, `unique` |
| `description` | `text` | nullable |
| `created_at` | `timestamptz` | `not null`, `default now()` |
| `updated_at` | `timestamptz` | `not null`, `default now()` (auto-maintained by trigger) |

Triggers: `teams_set_updated_at` (`before update`, calls `set_updated_at()`).

### `profiles`

1:1 with `auth.users`. A row is created automatically by the `handle_new_user` trigger when a new auth user signs up — direct inserts are blocked by `profiles_no_direct_insert`.

| Column | Type | Constraints / default |
|---|---|---|
| `id` | `uuid` | primary key, `references auth.users(id) on delete cascade` |
| `email` | `text` | `not null` |
| `full_name` | `text` | nullable |
| `username` | `text` | nullable, `unique` |
| `avatar_url` | `text` | nullable |
| `bio` | `text` | nullable |
| `github_username` | `text` | nullable |
| `github_profile_url` | `text` | nullable |
| `timezone` | `text` | `not null`, `default 'Asia/Karachi'` |
| `created_at` | `timestamptz` | `not null`, `default now()` |
| `updated_at` | `timestamptz` | `not null`, `default now()` (auto-maintained) |

Triggers: `profiles_set_updated_at` (`before update`). The `on_auth_user_created` trigger on `auth.users` calls `handle_new_user()` to seed `id`, `email`, and `full_name` (the latter pulled from `raw_user_meta_data->>'full_name'` set during sign-up).

Note: role and membership are NOT in this table — they live in `team_members`. A profile update therefore cannot escalate privileges.

### `team_members`

The join that actually grants team access. A registered user has a `profiles` row but no `team_members` row until an admin adds them.

| Column | Type | Constraints / default |
|---|---|---|
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `team_id` | `uuid` | `not null`, `references public.teams(id) on delete cascade` |
| `user_id` | `uuid` | `not null`, `references public.profiles(id) on delete cascade` |
| `role` | `public.team_role` | `not null`, `default 'member'` |
| `membership_status` | `public.membership_status` | `not null`, `default 'pending_approval'` |
| `joined_at` | `timestamptz` | nullable (set when status flips to `active`) |
| `suspended_at` | `timestamptz` | nullable |
| `removed_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | `not null`, `default now()` |
| `updated_at` | `timestamptz` | `not null`, `default now()` (auto-maintained) |

Constraints: `unique (team_id, user_id)` — a user has at most one membership row per team.

Indexes:
- `team_members_user_idx` on `(user_id)`.
- `team_members_team_status_idx` on `(team_id, membership_status)`.

Triggers: `team_members_set_updated_at` (`before update`).

### `invitations`

Admin/leader invites a user by email → the invitee signs up → an admin approves them → their `team_members` row flips to `active`. The `invitations` table records the invite lifecycle.

| Column | Type | Constraints / default |
|---|---|---|
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `team_id` | `uuid` | `not null`, `references public.teams(id) on delete cascade` |
| `email` | `text` | `not null` |
| `role` | `public.team_role` | `not null`, `default 'member'` |
| `invited_by` | `uuid` | `not null`, `references public.profiles(id)` |
| `status` | `public.invitation_status` | `not null`, `default 'sent'` |
| `expires_at` | `timestamptz` | nullable |
| `accepted_at` | `timestamptz` | nullable |
| `revoked_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | `not null`, `default now()` |
| `updated_at` | `timestamptz` | `not null`, `default now()` (auto-maintained) |

Indexes:
- `invitations_team_status_idx` on `(team_id, status)`.
- `invitations_email_idx` on `(email)`.

Triggers: `invitations_set_updated_at` (`before update`).

## Enums (D8)

All enums are created in 0001 with `do $$ begin ... exception when duplicate_object then null; end $$` so they are idempotent. The full set:

| Enum | Values |
|---|---|
| `team_role` | `admin`, `leader`, `member` |
| `membership_status` | `pending_invite`, `pending_approval`, `active`, `suspended`, `removed` |
| `invitation_status` | `sent`, `accepted`, `expired`, `revoked` |
| `phase_status` | `draft`, `published`, `archived` |
| `week_status` | `draft`, `published`, `archived` |
| `topic_status` | `locked`, `available`, `in_progress`, `completed` |
| `topic_difficulty` | `beginner`, `intermediate`, `advanced` |
| `resource_type` | `article`, `video`, `book`, `documentation`, `course`, `tool`, `other` |
| `assignment_type` | `programming_exercise`, `written_explanation`, `research_activity`, `data_analysis`, `quiz`, `mini_project`, `group_project` |
| `assignment_difficulty` | `beginner`, `intermediate`, `advanced` |
| `submission_type` | `github_repo`, `github_pr`, `github_commit`, `external_url`, `written`, `document`, `image`, `file` |
| `submission_status` | `not_started`, `in_progress`, `submitted`, `under_review`, `revision_requested`, `approved`, `rejected` |
| `review_status` | `pending`, `approved`, `revision_requested`, `rejected` |
| `blocker_priority` | `low`, `medium`, `high`, `critical` |
| `blocker_status` | `open`, `being_addressed`, `resolved` |
| `publication_status` | `draft`, `published`, `archived` |
| `notification_type` | `new_assignment`, `deadline_approaching`, `submission_reviewed`, `revision_requested`, `new_announcement`, `weekly_report_due`, `blocker_updated` |

Phase 2 tables use only `team_role`, `membership_status`, and `invitation_status`. The remaining enums are declared now so that adding the future-phase tables in later migrations does not change the generated TypeScript types for the Phase 2 tables.

## Triggers

| Trigger | Table / event | Function | Purpose |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` `after insert` | `handle_new_user()` (`security definer`) | Inserts a matching `profiles` row (`id`, `email`, `full_name`) when a new auth user is created. |
| `teams_set_updated_at` | `teams` `before update` | `set_updated_at()` | Sets `updated_at = now()`. |
| `profiles_set_updated_at` | `profiles` `before update` | `set_updated_at()` | Sets `updated_at = now()`. |
| `team_members_set_updated_at` | `team_members` `before update` | `set_updated_at()` | Sets `updated_at = now()`. |
| `invitations_set_updated_at` | `invitations` `before update` | `set_updated_at()` | Sets `updated_at = now()`. |

`handle_new_user()` is `security definer` with `search_path = public` so it can insert into `public.profiles` even though the calling user (a freshly signed-up auth user) has no direct insert privilege (direct inserts are blocked by `profiles_no_direct_insert`).

## Helper functions

All four helpers are `security definer`, `stable`, `security definer set search_path = public`. They are the only authorization primitives the RLS policies call.

| Function | Returns | Description |
|---|---|---|
| `current_team_id()` | `uuid` | Returns the id of the single launch team (`select id from teams order by created_at asc limit 1`). |
| `is_active_member_of(p_team_id uuid)` | `boolean` | True if `auth.uid()` has a `team_members` row for the team with `membership_status='active'`. |
| `is_team_admin_of(p_team_id uuid)` | `boolean` | True if `auth.uid()` has an active `admin` membership on the team. |
| `is_team_leader_or_admin_of(p_team_id uuid)` | `boolean` | True if `auth.uid()` has an active `admin` or `leader` membership on the team. |

Note the difference between `is_team_admin_of` (admin only) and `is_team_leader_or_admin_of` (admin + leader). Leaders can read the roster and create invitations but cannot change roles, suspend, remove, or revoke invitations.

## Relationships

```
auth.users (1) ──< (1) profiles
                          │
                          │  (team_members.user_id → profiles.id)
                          ▼
teams (1) ──< (N) team_members (N) >── (1) profiles
teams (1) ──< (N) invitations
                     │
                     │  (invitations.invited_by → profiles.id)
                     ▼
                  profiles
```

- `profiles` is 1:1 with `auth.users`. The `id` column references `auth.users(id) on delete cascade`, so deleting the auth user deletes the profile.
- `team_members` is N:1 to `teams` and N:1 to `profiles`, both `on delete cascade`. The `unique (team_id, user_id)` constraint makes the relationship 1:1 per team (a user has at most one membership per team).
- `invitations` is N:1 to `teams` (`on delete cascade`) and N:1 to `profiles` via `invited_by` (no cascade — the inviting admin's profile is preserved even if the invitation is later deleted).

## Future-phase tables (NOT in 0001)

Tables that arrive in later migrations include `phases`, `weeks`, `topics`, `resources` (learning materials), `topic_progress`, `assignments`, `task_assignments` (per-member assignment), `submissions`, `submission_files`, `reviews`, `submission_revisions`, `weekly_reports`, `learning_blockers`, `announcements`, `notifications`, `activity_logs`, `discussions`, and the database views `individual_progress`, `team_progress`, and `overdue_assignments`. None of these exist in the current database — see [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) for which migration adds which.
