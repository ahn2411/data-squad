# Implementation Roadmap

This roadmap continues the existing application. It preserves the current product identity, Next.js/Supabase/Vercel architecture, and existing migrations.

## Stage 1 — Audit and baseline (COMPLETE)

- [x] Inspect repository structure, Git state, dependencies, routes, feature actions/queries, migrations, and environment variable names.
- [x] Record current feature gaps in `COMPLETION_AUDIT.md` and `FEATURE_COMPLETION_TRACKER.md`.
- [x] Run typecheck, lint and production build. Current lint completes without warnings.
- [x] Reconcile architecture and permission documentation with current application architecture.

## Stage 2 — Close member lifecycle gaps

- [x] Implement invitation email delivery and verified callback role attachment (runtime SMTP/redirect verification remains).
- [ ] Verify pending signup, email confirmation, admin approval, suspension, and removal with distinct roles.
- [ ] Ensure leaders have explicit, limited operational permissions.

## Stage 3 — Secure persistent uploads

- [x] Define versioned Storage bucket/policy migration(s) for avatars and private learning attachments.
- [x] Implement assignment resource upload/removal and member signed downloads in source (migration 0011); disposable-project RLS test remains.
- [x] Implement blocker upload/removal and team-member signed downloads in source (migration 0012); disposable-project RLS test remains.
- [ ] Document and verify production bucket setup; never expose private objects publicly.

## Stage 4 — Curriculum and progress completeness

- [ ] Audit all 24 weeks and 83 topics against requested objectives, prerequisites, exercises, resources, assignments, deliverables, and criteria.
- [ ] Extend existing curriculum tables where practical; add tables only for distinct persisted exercise/assignment content.
- [x] Add an idempotent post-bootstrap seed for missing weekly assignment drafts using the existing assignments table; runtime seed verification and admin review/publication remain pending.
- [x] Enforce required topic/week completion criteria and calculate topic, week, and phase progress in source (database/RLS runtime validation remains).
- [x] Show each week’s estimated study time by summing its topic-level minutes; a static source audit found positive estimates for all 83 topics (runtime curriculum rows remain unverified).
- [x] Implement editing existing learning resources in the admin roadmap manager; runtime persistence and role/RLS behavior remain to be verified.
- [x] Add phase-appropriate steps, checks, and expected artifacts to all 83 unchanged seeded topic exercises in forward-only migration 0028; database execution and preservation of prior administrator edits remain unverified.
- [ ] Runtime-verify migrations 0016–0018 preserve administrator edits and validate per-topic resource coverage/content.
- [ ] Execute migration 0028 on a disposable Supabase project; verify all 24 week guides, existing custom exercise preservation, and rerun idempotency.

## Stage 5 — Assignment/review lifecycle

- [ ] Verify valid state transitions and concurrent submissions/reviews.
- [x] Add migration 0025 for append-only review history and database-level review state/score guards; disposable-project RLS and concurrency checks remain pending.
- [x] Validate submission assignment IDs and surface submission/revision-history database errors without reporting partial writes as successful (failure-injection and concurrent revision tests remain pending).
- [ ] Verify assignment attachments; exercise submission attachment uploads, signed downloads, limits, invalid files, concurrency limits, and RLS denial behavior.
- [x] Add submission receipt, discussion reply, blocker response/status notification triggers.
- [x] Implement deadline and missing-report reminders through a secret-protected twice-daily Vercel cron and unique dedupe keys (runtime schedule and database verification remain).
- [x] Add notification-center pagination, global unread count, correct SQL NULL read predicates, and a matching ordering index; RLS/runtime behavior remains to be verified.
- [x] Save assignment recipients before publish-trigger notification fan-out and add migration 0023 to restrict targeted notices to active selected recipients; database audience tests remain pending.
- [ ] Execute/test notification trigger and reminder migrations on a disposable Supabase project.

## Stage 6 — Reporting and collaboration

- [x] Define a seven-day member report edit window, display its cutoff, and enforce it in migration 0020 and the server action; RLS/database runtime verification remains.
- [x] Schedule deduplicated missing-report reminders in the existing protected cron (runtime schedule and database verification remain).
- [x] Add server-side discussion pagination with URL-preserved category/search filters; browser/database verification remains.
- [ ] Decide whether multi-level replies or mentions are required by the current collaboration scope.
- [x] Implement reporter close/reopen and blocker attachment workflows in source (migration 0012); disposable-project transition and file RLS tests remain.
- [x] Add discussion reply and blocker response notifications in versioned migration 0010; database execution and duplicate behavior remain unverified.
- [x] Show leaders/admins which active members are missing a report for a selected week; database/RLS and browser verification remain pending.

## Stage 7 — Communication, GitHub, search, dashboards

- [ ] Add announcement scheduling only if it can be delivered reliably within Vercel/Supabase architecture.
- [x] Add a real member GitHub profile directory using stored profile links; no API sync.
- [x] Store and show a validated capstone repository link on member profiles; migration 0026 and runtime checks remain pending.
- [x] Add a leader/admin member detail route with team-scoped profile, progress, submission, report, and blocker history; runtime/RLS verification remains pending.
- [x] Add title search and server-side pagination to the member announcements feed; runtime query and browser checks remain pending.
- [x] Move member assignment search/status filtering to the server and paginate results in 20-row pages; database and browser checks remain pending.
- [x] Add database-side status/search filtering and 20-row pagination to the admin assignments list; role, database, and browser checks remain pending.
- [x] Add server-side filters, reporter search and 20-row pagination to member and admin/leader blocker lists; runtime role and browser checks remain pending.
- [x] Add server-side search across report content, member identity and week title, plus URL-preserved filters and 20-row pagination for the leader/admin weekly report list; database and browser verification remain pending.
- [x] Move admin announcement title/content search, status filtering, and 20-row pagination into the leader/admin server query; database and browser verification remain pending.
- [ ] Complete missing search/filter/pagination cases.
- [ ] Validate dashboard calculations against fixture data and role access.

## Stage 8 — QA and production readiness

- [x] Prepare a forward-only mitigation for profile email/timezone exposure: migration 0027 revokes table-level profile grants, grants explicit non-private columns, and adds an owner-only timezone RPC; application profile joins/search no longer request email. Apply on a disposable Supabase project and verify direct authenticated read/update denial before production rollout.
- [x] Add forward-only migration 0024 pinning search paths for public `SECURITY DEFINER` functions; verify catalog settings and role behavior on disposable Supabase remains pending.
- [ ] Add focused unit/integration coverage for authorization, state transitions, and data calculations.
- [ ] Exercise admin, leader, and member workflows; run RLS denial checks.
- [ ] Fix lint/build/console/accessibility/responsive issues.
- [ ] Verify Vercel/Supabase region and request timings after the performance changes deploy.
- [ ] Produce an explicit deployment checklist. Apply production migrations only when separately authorized.

## Constraints

- Keep the live deployment and production records intact.
- Do not rewrite historical migrations; use new numbered migrations.
- Do not invent data or claim runtime verification without evidence.
- Mark external setup separately from application implementation.
