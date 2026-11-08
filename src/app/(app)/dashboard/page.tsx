import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  Inbox,
  Layers,
  Map,
  Megaphone,
  TriangleAlert,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RoleBadge, StatusPill } from "@/components/status-pill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireActiveMember, type ActiveSession } from "@/features/auth/session";
import {
  getAdminDashboardData,
  getMemberDashboardData,
  type AdminDashboardData,
  type MemberDashboardData,
} from "@/features/progress/queries";
import { formatDate, percent, relativeTime } from "@/lib/format";
import type {
  BlockerPriority,
  SubmissionStatus,
} from "@/types/database";
import { LearningActivityChart } from "./learning-activity-chart";
import { TeamProgressChart } from "./team-progress-chart";

// ─────────────────────────────────────────────────────────────────────────────
// Page — Server Component. Branches on role, fetches via progress queries,
// wraps each fetch in try/catch so a single failure shows a message instead of
// a full-page crash.
// ─────────────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await requireActiveMember();
  const teamId = session.membership.team_id;
  const isAdminOrLeader =
    session.membership.role === "admin" ||
    session.membership.role === "leader";

  // Fetch real DB-backed data. A failure in any query bubbles up here and
  // degrades to an honest error state instead of crashing the whole page.
  let adminData: AdminDashboardData | null = null;
  let memberData: MemberDashboardData | null = null;
  let fetchFailed = false;

  if (isAdminOrLeader) {
    try {
      adminData = await getAdminDashboardData(session.userId, teamId);
    } catch {
      fetchFailed = true;
    }
  } else {
    try {
      memberData = await getMemberDashboardData(session.userId, teamId);
    } catch {
      fetchFailed = true;
    }
  }

  if (fetchFailed) {
    return <DashboardErrorState />;
  }
  if (isAdminOrLeader && adminData) {
    return <AdminDashboardView data={adminData} session={session} />;
  }
  if (!isAdminOrLeader && memberData) {
    return <MemberDashboardView data={memberData} session={session} />;
  }
  return <DashboardErrorState />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared presentational helpers (server-only; no client interactivity needed)
// ─────────────────────────────────────────────────────────────────────────────

function DashboardErrorState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-[14px] font-semibold text-foreground">
            Couldn&apos;t load your dashboard
          </p>
          <p className="text-[13px] text-muted-foreground">
            We hit a problem fetching your data. Refresh the page to try again.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function StatCard({ label, icon, children }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <span className="text-muted-foreground/70">{icon}</span>
        </div>
        <div className="mt-2.5">{children}</div>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-xs text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
        >
          {actionLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

const submissionStatusConfig: Record<
  SubmissionStatus,
  {
    tone: "muted" | "warning" | "danger" | "success" | "navy" | "teal";
    label: string;
  }
> = {
  not_started: { tone: "muted", label: "Not started" },
  in_progress: { tone: "navy", label: "In progress" },
  submitted: { tone: "teal", label: "Submitted" },
  under_review: { tone: "navy", label: "Under review" },
  revision_requested: { tone: "warning", label: "Revision requested" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
};

function SubmissionStatusPill({ status }: { status: SubmissionStatus }) {
  const c = submissionStatusConfig[status];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

const blockerPriorityConfig: Record<
  BlockerPriority,
  { tone: "muted" | "warning" | "danger" | "navy"; label: string }
> = {
  low: { tone: "muted", label: "Low" },
  medium: { tone: "navy", label: "Medium" },
  high: { tone: "warning", label: "High" },
  critical: { tone: "danger", label: "Critical" },
};

function BlockerPriorityBadge({ priority }: { priority: BlockerPriority }) {
  const c = blockerPriorityConfig[priority];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

function LateBadge() {
  return (
    <Badge
      variant="outline"
      className="border-warning/30 bg-warning/10 px-1.5 py-0 text-[10px] font-medium text-warning"
    >
      Late
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Member dashboard view
// ─────────────────────────────────────────────────────────────────────────────

function MemberDashboardView({
  data,
  session,
}: {
  data: MemberDashboardData;
  session: ActiveSession;
}) {
  const rawName = session.profile?.full_name ?? session.email;
  const firstName = rawName.split(/\s+/)[0] ?? "there";
  const hoursLabel =
    data.weeklyHours > 0 ? `${data.weeklyHours.toFixed(1)}h` : "—";

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Welcome back, ${firstName}. Here's where your learning stands today.`}
      />

      {/* Stat row — 4 compact cards. Distinct metrics, never combined. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Current focus" icon={<Layers className="size-4" />}>
          <div className="space-y-0.5">
            <p className="text-[15px] font-semibold leading-tight text-foreground">
              {data.currentWeek
                ? `Week ${data.currentWeek.week_number}`
                : "Not set"}
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              {data.currentPhase?.title ?? "No phase assigned yet"}
            </p>
          </div>
        </StatCard>

        <StatCard label="Roadmap progress" icon={<Map className="size-4" />}>
          <div className="space-y-1.5">
            <p className="nums text-[18px] font-semibold tabular-nums text-foreground">
              {percent(data.roadmapProgress.ratio)}
            </p>
            <Progress
              value={data.roadmapProgress.ratio * 100}
              className="h-1.5"
            />
            <p className="text-[11px] text-muted-foreground">
              <span className="nums">{data.roadmapProgress.completedTopics}</span>
              {" / "}
              <span className="nums">{data.roadmapProgress.totalTopics}</span>
              {" topics"}
            </p>
          </div>
        </StatCard>

        <StatCard
          label="Pending assignments"
          icon={<ClipboardList className="size-4" />}
        >
          <div className="flex items-baseline gap-1.5">
            <p className="nums text-[18px] font-semibold tabular-nums text-foreground">
              {data.pendingAssignments.length}
            </p>
            <p className="text-[11px] text-muted-foreground">to complete</p>
          </div>
        </StatCard>

        <StatCard
          label="Reported hours (total)"
          icon={<Clock className="size-4" />}
        >
          <p className="nums text-[18px] font-semibold tabular-nums text-foreground">
            {hoursLabel}
          </p>
        </StatCard>
      </div>

      {/* Learning activity chart (Recharts, client) */}
      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Learning activity</CardTitle>
            <CardDescription className="text-[12px]">
              Hours reported per week, from your weekly reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.weeklyHoursByReport.length > 0 ? (
              <LearningActivityChart
                data={data.weeklyHoursByReport.map((p) => ({
                  label:
                    p.weekNumber !== null
                      ? `Wk ${p.weekNumber}`
                      : (p.weekTitle.slice(0, 8) || "Week"),
                  hours: p.hours,
                }))}
              />
            ) : (
              <EmptyState
                icon={<Clock className="size-4" />}
                title="No weekly reports yet"
                description="Once you submit a weekly report, your learning hours will appear here."
                actionHref="/weekly-reports"
                actionLabel="Submit a weekly report"
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Current week */}
      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Current week</CardTitle>
            <CardDescription className="text-[12px]">
              Active week set by your team lead
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.currentWeek ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-foreground">
                      Week {data.currentWeek.week_number} — {data.currentWeek.title}
                    </p>
                    {data.currentPhase ? (
                      <p className="text-[12px] text-muted-foreground">
                        Phase {data.currentPhase.phase_number}: {data.currentPhase.title}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/roadmap/${data.currentWeek.id}`}
                    className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                  >
                    Open week
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                {data.currentWeek.objectives.length > 0 ? (
                  <ul className="space-y-1.5 text-[13px] text-muted-foreground">
                    {data.currentWeek.objectives.slice(0, 4).map((o, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">{o}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    No objectives published for this week.
                  </p>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarDays className="size-4" />}
                title="No current week set"
                description="Your team lead hasn't set the active week yet. Browse the roadmap to keep learning."
                actionHref="/roadmap"
                actionLabel="Browse roadmap"
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Pending assignments + Upcoming deadlines */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Pending assignments</CardTitle>
            <CardDescription className="text-[12px]">
              Assigned and not yet approved
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.pendingAssignments.length > 0 ? (
              <ul className="space-y-1">
                {data.pendingAssignments.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/assignments/${a.id}`}
                      className="group flex items-start justify-between gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {a.title}
                        </p>
                        <p className="text-[11px] capitalize text-muted-foreground">
                          {a.week_title ? `${a.week_title} · ` : ""}
                          {a.difficulty.replace("_", " ")}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<ClipboardList className="size-4" />}
                title="Nothing pending"
                description="All your assigned work is done. New assignments will appear here."
                actionHref="/assignments"
                actionLabel="View all assignments"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Upcoming deadlines</CardTitle>
            <CardDescription className="text-[12px]">
              Next three deadlines on your pending work
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingDeadlines.length > 0 ? (
              <ul className="space-y-1">
                {data.upcomingDeadlines.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/assignments/${a.id}`}
                      className="group flex items-center justify-between gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {a.title}
                        </p>
                        <p className="nums text-[11px] text-muted-foreground">
                          Due {formatDate(a.deadline)}
                        </p>
                      </div>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<CalendarDays className="size-4" />}
                title="No deadlines"
                description="Your pending work has no due dates set."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent submissions */}
      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Recent submissions</CardTitle>
            <CardDescription className="text-[12px]">
              Your latest five with status and review feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentSubmissions.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.recentSubmissions.map((s) => (
                  <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={`/submissions/${s.id}`}
                      className="group flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {s.assignment_title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <SubmissionStatusPill status={s.status} />
                          <span className="nums text-[11px] text-muted-foreground">
                            {relativeTime(s.submitted_at)}
                          </span>
                          {s.is_late ? <LateBadge /> : null}
                        </div>
                        {s.review_feedback ? (
                          <p className="line-clamp-1 text-[12px] italic text-muted-foreground">
                            &ldquo;{s.review_feedback}&rdquo;
                          </p>
                        ) : null}
                      </div>
                      <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Inbox className="size-4" />}
                title="No submissions yet"
                description="When you submit work for an assignment, it will show up here."
                actionHref="/assignments"
                actionLabel="Find an assignment"
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Active blockers + Recent announcements */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Active blockers</CardTitle>
            <CardDescription className="text-[12px]">
              Issues you&apos;ve raised that aren&apos;t resolved
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.activeBlockers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[13px] text-muted-foreground">
                  <span className="nums text-[20px] font-semibold tabular-nums text-foreground">
                    {data.activeBlockers.length}
                  </span>{" "}
                  open
                </p>
                <ul className="space-y-1.5">
                  {data.activeBlockers.slice(0, 4).map((b) => (
                    <li
                      key={b.id}
                      className="flex items-start justify-between gap-2"
                    >
                      <Link
                        href="/blockers"
                        className="truncate text-[13px] font-medium text-foreground hover:underline"
                      >
                        {b.title}
                      </Link>
                      <BlockerPriorityBadge priority={b.priority} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState
                icon={<TriangleAlert className="size-4" />}
                title="No active blockers"
                description="Stuck on something? Raise a blocker so your team can help."
                actionHref="/blockers"
                actionLabel="Report a blocker"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Recent announcements</CardTitle>
            <CardDescription className="text-[12px]">
              Latest from your team leads
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentAnnouncements.length > 0 ? (
              <ul className="space-y-3">
                {data.recentAnnouncements.map((a) => (
                  <li key={a.id}>
                    <Link
                      href="/announcements"
                      className="group block space-y-0.5"
                    >
                      <div className="flex items-center gap-2">
                        {a.pinned ? (
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary"
                          >
                            Pinned
                          </Badge>
                        ) : null}
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {a.title}
                        </p>
                      </div>
                      <p className="line-clamp-1 text-[12px] text-muted-foreground">
                        {a.content ?? ""}
                      </p>
                      <p className="nums text-[11px] text-muted-foreground">
                        {relativeTime(a.published_at)} · {a.author_name}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Megaphone className="size-4" />}
                title="No announcements"
                description="Team-wide announcements will appear here."
                actionHref="/announcements"
                actionLabel="Browse announcements"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin / leader dashboard view
// ─────────────────────────────────────────────────────────────────────────────

function AdminDashboardView({
  data,
}: {
  data: AdminDashboardData;
  session: ActiveSession;
}) {
  return (
    <>
      <PageHeader
        title="Team overview"
        description="Real-time snapshot of your squad's progress, review queue, and activity."
      />

      {/* Stat row — distinct metrics, never combined. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total members" icon={<Users className="size-4" />}>
          <p className="nums text-[18px] font-semibold tabular-nums text-foreground">
            {data.totalMembers}
          </p>
        </StatCard>
        <StatCard label="Active members" icon={<Users className="size-4" />}>
          <p className="nums text-[18px] font-semibold tabular-nums text-foreground">
            {data.activeMembers}
          </p>
        </StatCard>
        <StatCard
          label="Pending review"
          icon={<ClipboardList className="size-4" />}
        >
          <p className="nums text-[18px] font-semibold tabular-nums text-foreground">
            {data.pendingSubmissions}
          </p>
        </StatCard>
        <StatCard label="Open blockers" icon={<TriangleAlert className="size-4" />}>
          <p className="nums text-[18px] font-semibold tabular-nums text-foreground">
            {data.openBlockers.length}
          </p>
        </StatCard>
        <StatCard label="Team progress" icon={<BarChart3 className="size-4" />}>
          <div className="space-y-1.5">
            <p className="nums text-[18px] font-semibold tabular-nums text-foreground">
              {percent(data.teamProgress)}
            </p>
            <Progress value={data.teamProgress * 100} className="h-1.5" />
          </div>
        </StatCard>
      </div>

      {/* Review queue */}
      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Review queue</CardTitle>
            <CardDescription className="text-[12px]">
              Submissions awaiting your review
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.reviewQueue.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.reviewQueue.map((s) => (
                  <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={`/submissions/${s.id}`}
                      className="group flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {s.assignmentTitle}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <SubmissionStatusPill status={s.status} />
                          <span className="text-[11px] text-muted-foreground">
                            {s.userName}
                          </span>
                          <span className="nums text-[11px] text-muted-foreground">
                            · {relativeTime(s.updatedAt)}
                          </span>
                          {s.isLate ? <LateBadge /> : null}
                        </div>
                      </div>
                      <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Check className="size-4" />}
                title="Queue is clear"
                description="No submissions are waiting for review right now."
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Member progress table + team progress chart */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-[14px]">Member progress</CardTitle>
            <CardDescription className="text-[12px]">
              Topics completed, assignments approved, last activity
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.memberProgressList.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[160px] pl-6">Member</TableHead>
                    <TableHead className="w-[80px]">Role</TableHead>
                    <TableHead className="w-[90px] text-right">Topics</TableHead>
                    <TableHead className="w-[110px] text-right">Approved</TableHead>
                    <TableHead className="w-[120px] pr-6 text-right">
                      Last activity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.memberProgressList.slice(0, 10).map((m) => (
                    <TableRow key={m.userId} className="group">
                      <TableCell className="pl-6">
                        <Link href="/admin/members" className="block">
                          <p className="text-[13px] font-medium text-foreground">
                            {m.name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {m.email}
                          </p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={m.role} />
                      </TableCell>
                      <TableCell className="nums text-right text-[13px] tabular-nums text-foreground">
                        {m.topicsCompleted}
                      </TableCell>
                      <TableCell className="nums text-right text-[13px] tabular-nums text-foreground">
                        {m.assignmentsApproved}
                      </TableCell>
                      <TableCell className="nums pr-6 text-right text-[12px] tabular-nums text-muted-foreground">
                        {m.lastActivity ? relativeTime(m.lastActivity) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6 pb-2">
                <EmptyState
                  icon={<Users className="size-4" />}
                  title="No active members"
                  description="Active members will appear here once approved."
                  actionHref="/admin/members"
                  actionLabel="Manage members"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[14px]">Roadmap by member</CardTitle>
            <CardDescription className="text-[12px]">
              Completed required topics per active member
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.memberProgressList.length > 0 ? (
              <TeamProgressChart
                data={data.memberProgressList
                  .slice(0, 8)
                  .map((m) => ({
                    label: (m.name.split(/\s+/)[0] ?? m.name).slice(0, 12),
                    ratio: m.roadmapRatio,
                  }))}
              />
            ) : (
              <EmptyState
                icon={<BarChart3 className="size-4" />}
                title="No data yet"
                description="Once members complete topics, the chart will populate."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Open blockers + Weekly report completion */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Open blockers</CardTitle>
            <CardDescription className="text-[12px]">
              Across the team
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.openBlockers.length > 0 ? (
              <ul className="space-y-1">
                {data.openBlockers.slice(0, 5).map((b) => (
                  <li
                    key={b.id}
                    className="flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <Link
                        href="/blockers"
                        className="truncate text-[13px] font-medium text-foreground hover:underline"
                      >
                        {b.title}
                      </Link>
                      <p className="nums text-[11px] text-muted-foreground">
                        {relativeTime(b.created_at)}
                      </p>
                    </div>
                    <BlockerPriorityBadge priority={b.priority} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Check className="size-4" />}
                title="No open blockers"
                description="The team has no unresolved blockers right now."
                actionHref="/blockers"
                actionLabel="View all blockers"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Weekly report completion</CardTitle>
            <CardDescription className="text-[12px]">
              {data.weeklyReportCompletion.currentWeekId
                ? "Submitted for the current week"
                : "No current week set"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.weeklyReportCompletion.totalActive > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-[13px] text-muted-foreground">
                    <span className="nums text-[20px] font-semibold tabular-nums text-foreground">
                      {data.weeklyReportCompletion.submitted}
                    </span>
                    {" / "}
                    <span className="nums">
                      {data.weeklyReportCompletion.totalActive}
                    </span>
                    {" active members"}
                  </p>
                  <p className="nums text-[13px] font-medium tabular-nums text-foreground">
                    {percent(data.weeklyReportCompletion.ratio)}
                  </p>
                </div>
                <Progress
                  value={data.weeklyReportCompletion.ratio * 100}
                  className="h-1.5"
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Reports are filed per week per member. Nudge anyone who
                  hasn&apos;t submitted yet.
                </p>
              </div>
            ) : (
              <EmptyState
                icon={<Users className="size-4" />}
                title="No active members"
                description="Approve members to start tracking weekly report completion."
                actionHref="/admin/members"
                actionLabel="Manage members"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Recent activity</CardTitle>
            <CardDescription className="text-[12px]">
              Latest notifications and submissions across the team
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.recentActivity.map((a) => {
                  const content = (
                    <>
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {a.kind === "notification" ? (
                          <Bell className="size-3.5" />
                        ) : (
                          <Inbox className="size-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-foreground">
                          {a.title}
                        </p>
                        {a.body ? (
                          <p className="line-clamp-1 text-[12px] text-muted-foreground">
                            {a.body}
                          </p>
                        ) : null}
                        <p className="nums text-[11px] text-muted-foreground">
                          {relativeTime(a.createdAt)}
                        </p>
                      </div>
                    </>
                  );
                  return (
                    <li key={a.id} className="py-2 first:pt-0 last:pb-0">
                      {a.link ? (
                        <Link
                          href={a.link}
                          className="group flex items-start gap-3"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={<Activity className="size-4" />}
                title="No recent activity"
                description="Notifications and submission events will show up here."
              />
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
