# Role and permission model

The current role values are `admin`, `leader`, and `member`; membership is separately `pending_invite`, `pending_approval`, `active`, `suspended`, or `removed`. The server session helper and database RLS must both enforce access. A hidden control is never an authorization boundary.

| Capability | Member | Leader | Admin |
|---|---|---|---|
| Read published curriculum and team announcements | Active members | Active members | Active members |
| Update own profile and learning progress | Yes | Yes | Yes |
| Create own reports, discussions, blockers and submissions | Yes | Yes | Yes |
| Edit own weekly report | Until seven days after its most recent save | Same | Same |
| Delete own weekly report | No | No | No |
| Close own blocker or reopen a closed/resolved blocker | Yes | Yes | Yes |
| Assign blocker helpers, edit resolution notes and set operational status | No | Yes, within team | Yes, within team |
| Upload/remove files on own blocker | Yes | Yes | Yes |
| Manage assignment resources | No | Yes, within team | Yes, within team |
| Read blocker attachments | Active team members | Active team members | Active team members |
| Review submissions / provide leader feedback | No | Yes, within team | Yes, within team |
| Manage assignments, announcements and curriculum | No | Per current RLS/action capability | Yes |
| Approve, suspend, remove members or change roles | No | No | Yes |
| Send member invitations | No | Yes, member role only | Yes, member or leader role |
| Grant or revoke a leader/admin role | No | No | Yes |
| Read team operational data | Only rows exposed by RLS | Team scope | Team scope |

Pending or suspended memberships must not access protected workspace data. Profiles contain private contact data; expose only the fields a particular team page needs. Members cannot change their own membership role/status. Leaders can invite member accounts but cannot grant elevated roles. Submission reviews prevent self-review at the database layer. Service-role operations belong only in server-only modules and must never be imported into Client Components.

## Verification still required

Run separate-account tests against a non-production Supabase project for each role, including direct REST attempts that bypass UI controls. Apply migrations 0001–0028 to a disposable project and inspect effective policies and column grants. For profiles, verify an authenticated member can select public profile columns, cannot select email/timezone, can retrieve only their own timezone through the RPC, and cannot update ungranted columns or another user's row. Verify membership status transitions reject stale requests, review rows cannot be updated/deleted, concurrent review decisions serialize, report edits succeed before the seven-day cutoff and fail after the cutoff even through direct REST, leader feedback can still be changed after the cutoff without changing report contents, and profile repository URLs reject non-GitHub destinations. Verify notification pages/unread totals and that users cannot update another user's read state. These checks have not been verified against production or a disposable project yet.
