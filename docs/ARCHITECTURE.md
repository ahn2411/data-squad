# Architecture

How the Phase 1 + Phase 2 codebase is laid out and how the pieces fit together. Phase 1 delivered the foundation (project scaffold, Supabase wiring, design tokens, the shell). Phase 2 delivered authentication and membership. Everything else is stubbed in the nav but not built — see [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md).

## Folder structure

Feature-based under `src/features/{auth,members,profile}`. Each feature has `actions.ts` (Server Actions), `schemas.ts` (Zod), and (for members) `queries.ts`. UI lives in `src/app` and `src/components`.

```
src/
├── middleware.ts                         # thin wrapper around updateSession
├── app/
│   ├── layout.tsx                        # root layout: Inter + JetBrains Mono, ThemeProvider, Toaster
│   ├── globals.css                       # Tailwind v4 + design tokens (oklch)
│   ├── page.tsx                          # root resolver — redirects by session state
│   ├── login/{page.tsx, login-form.tsx}
│   ├── register/{page.tsx, register-form.tsx}
│   ├── forgot-password/{page.tsx, forgot-form.tsx}
│   ├── reset-password/{page.tsx, reset-form.tsx}
│   ├── pending-approval/page.tsx         # gate screen for no-membership / pending / suspended / removed
│   ├── api/route.ts
│   └── (app)/                            # route group — layout gates on requireActiveMember
│       ├── layout.tsx                    # AppShell, role-filtered sidebar
│       ├── dashboard/page.tsx            # member overview
│       ├── profile/{page.tsx, profile-form.tsx}
│       └── admin/members/{page.tsx, members-table.tsx}
├── components/
│   ├── layout/{app-shell.tsx, sidebar-nav.tsx, sidebar-nav-data.tsx, user-menu.tsx}
│   ├── ui/                               # shadcn/ui New York primitives
│   ├── brand/logo.tsx
│   ├── theme-{provider,toggle}.tsx
│   ├── auth-shell.tsx
│   ├── not-configured-screen.tsx         # rendered when env vars are missing
│   ├── page-header.tsx
│   ├── sign-out-button.tsx
│   └── status-pill.tsx                   # RoleBadge + MembershipBadge
├── features/
│   ├── auth/{actions.ts, schemas.ts, session.ts}
│   ├── members/{actions.ts, queries.ts, schemas.ts}
│   └── profile/{actions.ts, schemas.ts}
├── hooks/{use-mobile.ts, use-toast.ts}
├── lib/
│   ├── format.ts                         # date / number helpers
│   ├── utils.ts                          # cn() tailwind-merge
│   ├── db.ts                             # Prisma client (present, not used by Phase 2)
│   └── supabase/{client.ts, server.ts, middleware.ts, configured.ts}
└── types/database.ts                     # hand-written Phase 1+2 types — regenerate via supabase:types
```

## The Supabase client pattern

Three clients in `src/lib/supabase/`, all driven by the publishable (anon) key:

| File | Role |
|---|---|
| `client.ts` | Browser client via `createBrowserClient(url, anonKey)`. Throws if env vars are missing. |
| `server.ts` | Server client via `createServerClient(url, anonKey, { cookies })`. Bound to the request cookies so RLS enforces as the acting user. The `setAll` callback swallows errors when called from a Server Component (the middleware refreshes sessions instead). |
| `middleware.ts` | `updateSession(request)` — refreshes the Supabase auth session on every navigation and guards protected routes. Public routes (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/pending-approval`) are reachable without a session; everything else requires an authenticated user and otherwise redirects to `/login?redirect=...`. Membership-status gating (pending/suspended/removed) is handled in the `(app)` layout, not here, to keep the middleware fast and avoid a per-request database query. |
| `configured.ts` | Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `isSupabaseConfigured()` returns false when either is missing. The root page and the `(app)` layout check this and render `NotConfiguredScreen` instead of crashing on an empty URL. Also exports `SupabaseNotConfiguredError`. |

The service-role key is **never** imported by browser code and is **not** re-exported from `configured.ts`. It is read directly from `process.env.SUPABASE_SERVICE_ROLE_KEY` only in privileged server paths.

`src/middleware.ts` is a one-line wrapper that calls `updateSession`. The matcher excludes static assets, image files, and Next internals.

## Routing

- **`/`** — the root resolver (`src/app/page.tsx`). It renders `NotConfiguredScreen` when Supabase is missing, otherwise calls `getSessionContext()` and redirects by status: `unauthenticated` → `/login`, `active` → `/dashboard`, `no-membership` / `pending` → `/pending-approval`, `suspended` → `/pending-approval?reason=suspended`, `removed` → `/pending-approval?reason=removed`. It renders no UI of its own.
- **Auth pages** — `/login`, `/register`, `/forgot-password`, `/reset-password`, `/pending-approval`. Standalone (not inside the `(app)` group). If a signed-in user hits `/login` or `/register`, the middleware bounces them to `/`.
- **App pages** — live in the `(app)` route group whose layout (`src/app/(app)/layout.tsx`) calls `requireActiveMember()` and renders the `AppShell` with a role-filtered sidebar.

Phase 2 routes that actually resolve:

| Route | Page | Who |
|---|---|---|
| `/dashboard` | Member overview: role, status, team, "member since", getting-started links. | Any active member. |
| `/profile` | Editable profile form (full name, username, bio, GitHub username + URL, timezone). | Any active member. |
| `/admin/members` | Members table — approve, suspend, reinstate, remove, change role, invite. | Admin + leader (leader sees but admin-only actions are disabled). |

The sidebar (`sidebar-nav-data.tsx`) lists the full intended IA (Roadmap, Assignments, Submissions, Weekly reports, GitHub, Discussions, Blockers, Announcements, Settings). Items not yet built render muted with a "Soon" tag — they are visible so the structure is clear without faking functionality.

## Server Actions vs client components

Every mutation in Phase 2 is a `"use server"` Server Action validated with Zod:

- `src/features/auth/actions.ts` — `signInAction`, `signUpAction`, `requestPasswordResetAction`, `updatePasswordAction`, `signOutAction`.
- `src/features/members/actions.ts` — `approveMemberAction`, `suspendMemberAction`, `reinstateMemberAction`, `removeMemberAction`, `changeRoleAction`, `inviteMemberAction`. Each starts with `requireAdmin()` which re-resolves the session via `getSessionContext()` and rejects non-admin callers — never trusts a client-supplied user id or role.
- `src/features/profile/actions.ts` — `updateProfileAction`. Restricts the editable field set (role, email, membership are deliberately excluded).

Client components (`*-form.tsx`, `members-table.tsx`, the shell) exist only where interactivity requires them. They use React Hook Form with the shared Zod schemas for instant client feedback; the same schemas run again on the server in the action, so client validation is UX only — the server is authoritative.

## The session model

`getSessionContext()` (`src/features/auth/session.ts`) is the single source of truth for layout gating and role-based redirects. It returns a typed `SessionContext` discriminated union:

| `status` | Meaning | What the layout does |
|---|---|---|
| `not-configured` | Supabase env vars missing. | Render `NotConfiguredScreen`. |
| `unauthenticated` | No session. | Redirect `/login`. |
| `no-membership` | Signed in, no `team_members` row. | Redirect `/pending-approval`. |
| `pending` | `pending_invite` or `pending_approval`. | Redirect `/pending-approval`. |
| `suspended` | `membership_status='suspended'`. | Redirect `/pending-approval?reason=suspended`. |
| `removed` | `membership_status='removed'`. | Redirect `/pending-approval?reason=removed`. |
| `active` | `membership_status='active'`. | Pass the `ActiveSession` (userId, email, profile, membership + team) to the layout. |

`requireActiveMember()` wraps `getSessionContext()` and returns the `ActiveSession` (or redirects). `requireRole(session, ["admin","leader"])` is a thin additional guard used by `/admin/members` — it redirects members back to `/dashboard`.

## Design tokens

`src/app/globals.css` defines the tokens. One navy primary, one teal accent, slate neutrals, plus restrained chart colors:

- Primary: `oklch(0.35 0.105 262)` — deep navy. Primary-foreground near-white.
- Teal accent: `oklch(0.6 0.118 184)`, used sparingly for progress and success.
- Surfaces use subtle off-whites (light) and near-black with a faint blue tint (dark). Pure `#fff` / `#000` are never used for large surfaces.
- Radius: `--radius: 0.5rem` (8px controls); `xl = 12px` containers.
- Type scale adds 13px (`--text-13`) and 32px (`--text-32`).
- Fonts: Inter (sans), JetBrains Mono (mono), loaded via `next/font/google` and exposed as CSS variables in the root layout.
- Light/dark via `next-themes` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`). The `dark` variant is wired as `&:is(.dark *)`.

## What is NOT built yet

Phase 2 ships auth, membership, the workspace shell, the dashboard, the profile editor, and the members admin table. The following are listed in the sidebar but are not implemented — they arrive in later phases (see [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)):

- Curriculum: phases, weeks, topics, learning resources, topic progress.
- Assignments and task assignments.
- Submissions, submission files (Storage), reviews, submission revisions.
- Progress tracking (the `individual_progress`, `team_progress`, `overdue_assignments` database views) and the Recharts dashboards.
- Weekly reports, learning blockers, announcements, notifications, activity logs.
- Discussions.
- GitHub sync (profile links are stored; nothing pulls activity).
- Storage uploads (avatars and submission files).
