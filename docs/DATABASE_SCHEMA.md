# Database schema

The database source of truth is the ordered SQL history in `supabase/migrations/`, currently `0001` through `0028`. This guide's original Phase 1/2 table catalog is historical and may not reflect later additions; use the current migrations as authoritative. Never edit an already-applied migration: add a new numbered migration and review its RLS and rollback implications.

The initial migration declares shared enums, and later migrations add/consume domain types. The original catalog below is retained as a reference, not a complete schema specification.

## Additions in migrations 0008–0028

Migration 0027 revokes table-level `profiles` privileges from `anon` and `authenticated`, then grants explicit profile-column access excluding email and timezone. Timezone remains writable by its owner but is readable only through `get_my_profile_timezone()`, a security-definer function that returns the caller's own timezone. This migration is in source and has not yet been applied or verified against a database.

Migration 0028 appends guided instructions and expected artifacts to each topic exercise whose text still exactly matches the original seed. It preserves edited exercise fields and is idempotent; it changes no schema or learner progress.

`assignment_files` (0011) stores private assignment resource metadata: assignment/team IDs, unique Storage object path, original file name, content type, byte size, uploader, and timestamp. A composite foreign key prevents mismatched assignment/team IDs; RLS permits authorized team members to read files only when `can_access_assignment` allows the assignment, while active leaders/admins manage metadata. The trigger serializes inserts per assignment and enforces the ten-file cap. File bytes live in the private `squad-attachments` bucket.

`blocker_files` (0012) stores private blocker attachment metadata with matching team/blocker IDs and an upload limit trigger. Active team members can read registered blocker files; the reporter and team leaders/admins can add/remove them. The `blocker_status` enum gains `closed`; a database trigger lets reporters close their own blockers and reopen closed/resolved requests as open, while keeping helper assignment and resolution-note edits restricted to leaders/admins. Migrations 0008–0010 establish private Storage and notification support. Migration 0013 records completion-criteria snapshots and makes its database trigger reject unchecked topic completion. Migration 0014 adds `week_progress` so each learner can record required weekly deliverables and completion criteria; a trigger limits selections to the week's configured requirements and RLS limits writes to the learner. Migration 0015 adds a unique nullable notification dedupe key for retry-safe scheduled reminders. Migration 0016 prevents seed reruns from replacing curriculum rows with prior edits while allowing authenticated administrator edits through the app. Migration 0017 fills week-level prerequisite guidance only for untouched seeded topics with an empty prerequisite list. Migration 0018 adds missing week-aligned resource links to published topics without overwriting existing rows. Migration 0019 installs privacy-minimal audit triggers for core team workflows; activity records remain insertable only by system triggers and readable by team leaders/admins. Migration 0020 limits member edits to seven days after the latest report save, removes member self-delete, and leaves the leader feedback-only update path intact. Migration 0021 adds an index matching the user's notification center ordering and page queries. Migration 0022 indexes stable newest-first, user-scoped submission history pagination. Migration 0023 scopes assignment publication notifications to active selected recipients (or all active team members for team-wide assignments). Migration 0024 pins `pg_catalog, public, pg_temp` as the search path for all public `SECURITY DEFINER` functions to prevent temporary or writable-schema objects from shadowing trusted lookup targets. Migration 0025 makes review records insert-only for leaders/admins, serializes decisions on the submission row, and rejects reviews for terminal states or scores outside the assignment limit. Migration 0026 adds a format-checked `capstone_repository_url` to `profiles`; it reuses existing member records rather than creating a separate project table.

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
| `email` | `text` | `not null`; private account contact, excluded from authenticated column grants by migration 0027 |
| `full_name` | `text` | nullable |
| `username` | `text` | nullable, `unique` |
| `avatar_url` | `text` | nullable |
| `bio` | `text` | nullable |
| `github_username` | `text` | nullable |
| `github_profile_url` | `text` | nullable |
| `capstone_repository_url` | `text` | nullable; migration 0026 restricts values to HTTPS GitHub owner/repository URLs |
| `timezone` | `text` | `not null`, `default 'Asia/Karachi'`; readable by the owner through `get_my_profile_timezone()` only after migration 0027 |
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
| `notification_type` | Base values in 0001: `new_assignment`, `deadline_approaching`, `submission_reviewed`, `revision_requested`, `new_announcement`, `weekly_report_due`, `blocker_updated`; 0007 adds `pending_member_review`; 0009 adds `submission_received`, `discussion_reply`, `blocker_response`. |

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

## Later migration tables

The later migrations in this repository define `phases`, `weeks`, `topics`, `learning_resources`, `topic_progress`, `assignments`, `assignment_recipients`, `submissions`, `submission_files`, `reviews`, `submission_revisions`, `weekly_reports`, `blockers`, `blocker_comments`, `announcements`, `notifications`, `activity_logs`, `discussion_threads`, and `discussion_posts`. Progress dashboards calculate values in server queries; the planned `individual_progress`, `team_progress`, and `overdue_assignments` views are not defined. Whether these migrations have been applied depends on the target Supabase project. See [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) for the migration sequence.
