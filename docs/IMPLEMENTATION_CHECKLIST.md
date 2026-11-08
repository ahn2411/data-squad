# Implementation Checklist — Data Science Squad Hub

> Persistent tracker per the master implementation prompt §22/§23.
> Status legend: ✅ done · ◐ partial · ⬜ not started

## Feature implementation status

| Area | Status before | Notes |
|---|---|---|
| Auth (login/register/forgot/reset/pending) | ✅ functional | Supabase @supabase/ssr, Server Actions, Zod |
| Member management (admin) | ✅ functional | approve/role/suspend/remove + RLS |
| Profile (edit own) | ✅ functional | github/bio/username/timezone |
| App shell (sidebar/topbar/theme/bell) | ✅ functional | collapsible sidebar, mobile sheet |
| Design system (tokens/font/dark mode) | ✅ functional | navy/teal/slate oklch, Inter |
| Dashboard | ✅ functional | member and admin dashboards use stored activity |
| Roadmap / curriculum | ✅ functional | migrations, seeded data, viewer, and admin editor |
| Assignments / submissions / reviews | ✅ functional | migrations and member/admin workflows |
| Progress tracking | ✅ functional | derived in server queries; no separate progress views |
| Weekly reports | ✅ functional | member reports and leader feedback |
| Discussions | ✅ functional | threads, replies, moderation, and search |
| Blockers | ✅ functional | member reporting and team follow-up |
| Announcements / notifications | ✅ functional | admin publishing, notification center, and bell |
| GitHub (profile links) | ◐ partial | profile stores username/url; no assignment/report attachment |
| Search / filtering | ⬜ none | |
| File storage (uploads) | ⬜ none | no buckets configured |

## What was built this session

### Database (migrations 0002–0005)
- ✅ `0002_roadmap.sql` — team_settings, phases, weeks, topics, learning_resources, topic_progress + RLS + updated_at triggers
- ✅ `0003_assignments.sql` — assignments, assignment_recipients, submissions, submission_revisions, submission_files, reviews + RLS + late-status and self-review triggers
- ✅ `0004_collaboration.sql` — weekly_reports, discussion_threads/posts, blockers/comments, announcements, notifications, activity_logs + RLS + 3 SECURITY DEFINER notification triggers (review/announcement/assignment-publish) + create_notification helper
- ✅ `0005_curriculum_seed.sql` — idempotent seed: 6 phases, 24 weeks, 83 topics, 12 real resources (official docs only, no invented URLs)

### Features (41 feature-module files, 23 pages)
- ✅ Roadmap — viewer (phases/weeks/topics), topic detail, topic progress (start/complete/reset), admin CRUD manager (create/edit/publish/delete phases/weeks/topics + inline resources)
- ✅ Assignments — member list (search + status filters), detail, admin create/edit/publish/archive, recipient multi-select, deadline/difficulty/type/scoring
- ✅ Submissions — submit (URL + text), edit (within allowed statuses), revision history (immutable append), delete (limited), late flag (auto)
- ✅ Reviews — leader/admin review queue, approve/revision/reject + score + feedback, self-review blocked, auto-notifies submitter
- ✅ Dashboards — member (real stats: current week, roadmap progress, pending assignments, deadlines, recent submissions, blockers, announcements, unread count, weekly hours chart) + admin (members, pending reviews, team progress chart, member progress table, open blockers, report completion, activity feed). All from real queries, no hardcoded numbers.
- ✅ Progress — individual/team/phase progress calculated from topic_progress + submissions; learning/assignment/participation/time kept distinct
- ✅ Weekly reports — member write/edit (all 11 fields, hours validated), leader view-all + filter + leader_feedback (leaders only touch feedback)
- ✅ Discussions — threads (10 categories), posts + 1-level replies, search + category filter, pin/lock (leader), mark-answer, soft-delete, edit own
- ✅ Blockers — "I'm stuck" create, member list, admin team table (status/priority/search), detail with status manager (assign helper, resolve) + comments
- ✅ Announcements — member list (pinned first), admin CRUD (create/edit/archive/delete), publish auto-notifies all active members
- ✅ Notifications — center (read/unread, mark one/all read, click→navigate), bell wired to real unread count + popover of latest 5. Notifications created ONLY by DB triggers (zero manual inserts — verified by grep).
- ◐ GitHub — profile stores username + profile URL (Phase 2). Assignment/report GitHub link attachment: submissions accept a URL; weekly reports accept github_links[]. No separate /github page (left "Soon" — GitHub is a link-store, not a feature surface).
- ◐ File uploads (Storage) — submission_files table + schema ready; browser upload UI omitted because no 'submissions' bucket exists. URL/text submissions are the primary path. Documented dependency.
- ✅ Search/filtering — on assignments, submissions, discussions, blockers, reports, announcements, admin tables

### Security (RLS — the real authorization layer)
- ✅ RLS enabled on all 24 tables
- ✅ Every policy uses `auth.uid()` — never trusts client user IDs
- ✅ Members can't self-assign/change role or membership status (admin-only writes on team_members)
- ✅ Members can't review their own submissions (database trigger + action guard)
- ✅ Notifications insertable only by SECURITY DEFINER triggers (no client insert policy)
- ✅ Activity logs read-only for leaders/admins, system-only writes
- ✅ Profile updates scoped to own row; role/email not in profiles (can't escalate via profile edit)
- ✅ Submission edits gated by status (not_started/in_progress/revision_requested only)

### Quality gates
- Previously reported checks: TypeScript, lint, route smoke checks, browser checks, and missing-environment graceful degradation. Re-run them against the current checkout before release.

## Known limitations / external dependencies
1. **File uploads** require creating a `submissions` Storage bucket + policies (spec D7). Schema + table ready; upload UI gated. URL/text submissions work fully.
2. **Profile pictures (avatars)** require an `avatars` bucket. Avatars show initials until then.
3. **Email delivery** (invite emails, password reset) depends on Supabase Auth email config. In-app notifications work regardless.
4. **Realtime** not wired (notifications are read on page load / refresh; no live socket). Supabase Realtime is in the stack and can be added later.
5. **Topic completion validation** is a deliberate self-action (per spec FR-R: not auto on view). Full validation against assignment submissions is a future enhancement — completion_criteria are stored for reference.
6. **Curriculum** is seeded but admin-editable; the seed is idempotent so re-running updates content in place.

## Next steps (recommended)
- Apply migrations 0001–0005 to the intended Supabase project and run bootstrap-admin.sql.
- Create the `submissions` + `avatars` Storage buckets with D7 policies to enable file uploads.
- Wire Supabase Realtime for live notifications.
- Add the `/settings` admin page if application-level settings are required.
