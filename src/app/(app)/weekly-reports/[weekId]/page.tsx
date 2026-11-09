import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  AlertCircle,
  Target,
  FileText,
  CheckCircle2,
  MessageSquare,
  LockKeyhole,
} from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusPill } from "@/components/status-pill";
import { Separator } from "@/components/ui/separator";
import {
  getWeeksForReport,
  getMyReport,
  getReportForUser,
  type WeekWithPhaseLite,
  type ReportWithProfile,
} from "@/features/reports/queries";
import { ReportForm } from "./report-form";
import { LeaderFeedbackForm } from "./leader-feedback-form";
import { formatDateTime, initials } from "@/lib/format";
import { getWeeklyReportEditDeadline } from "@/features/reports/policy";

export const metadata = { title: "Weekly report" };

interface PageProps {
  params: Promise<{ weekId: string }>;
  searchParams: Promise<{ user?: string }>;
}

export default async function WeeklyReportDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { weekId } = await params;
  const session = await requireActiveMember();
  const sp = await searchParams;

  const isLeader =
    session.membership.role === "admin" ||
    session.membership.role === "leader";

  const targetUserId =
    typeof sp.user === "string" && sp.user !== session.userId
      ? sp.user
      : null;

  // Resolve the week context (published weeks only for members; leaders see
  // drafts too via RLS, but the list query filters to published).
  let week: WeekWithPhaseLite | null = null;
  let loadError: string | null = null;
  try {
    const weeks = await getWeeksForReport();
    week = weeks.find((w) => w.id === weekId) ?? null;
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Could not load this week.";
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Weekly report" />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <BackLink />
      </>
    );
  }

  if (!week) {
    notFound();
  }

  // Leader/admin viewing another member's report → read-only + feedback form.
  if (targetUserId) {
    if (!isLeader) {
      // A non-leader trying to view someone else's report — redirect to their
      // own write/edit view for this week.
      return (
        <>
          <PageHeader
            title={week.title}
            description={`Week ${week.week_number}`}
          />
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>Not available</AlertTitle>
            <AlertDescription>
              You can only view your own weekly reports.
            </AlertDescription>
          </Alert>
          <BackLink />
        </>
      );
    }

    let report = null;
    let memberError: string | null = null;
    try {
      report = await getReportForUser(weekId, targetUserId);
    } catch (err) {
      memberError =
        err instanceof Error ? err.message : "Could not load this report.";
    }

    if (memberError) {
      return (
        <>
          <PageHeader title={week.title} description={`Week ${week.week_number}`} />
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{memberError}</AlertDescription>
          </Alert>
          <BackLink />
        </>
      );
    }

    return (
      <>
        <PageHeader
          title={week.title}
          description={`Week ${week.week_number}${
            week.phases ? ` · Phase ${week.phases.phase_number}: ${week.phases.title}` : ""
          }`}
        />
        <BackLink />
        {!report ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">
              <FileText className="size-6 text-muted-foreground" />
              <p className="mt-2 text-[14px] font-medium text-foreground">
                No report submitted yet
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                This member hasn&apos;t filed a report for {week.title} yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <ReportReadonlyView report={report} />
            <LeaderFeedbackForm
              key={`${report.id}:${report.leader_feedback ?? ""}`}
              reportId={report.id}
              defaultFeedback={report.leader_feedback ?? ""}
              memberName={
                report.profiles?.full_name ?? "Member"
              }
            />
          </div>
        )}
      </>
      );
  }

  // Own report — editable form.
  let myReport: Awaited<ReturnType<typeof getMyReport>> = null;
  let myError: string | null = null;
  try {
    myReport = await getMyReport(weekId);
  } catch (err) {
    myError =
      err instanceof Error ? err.message : "Could not load your report.";
  }

  if (myError) {
    return (
      <>
        <PageHeader
          title={week.title}
          description={`Week ${week.week_number}`}
        />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{myError}</AlertDescription>
        </Alert>
        <BackLink />
      </>
    );
  }

  const objectives = week.objectives ?? [];
  const editDeadline = myReport
    ? getWeeklyReportEditDeadline(myReport.submitted_at)
    : null;
  const reportLocked = editDeadline !== null && editDeadline.getTime() <= Date.now();

  return (
    <>
      <PageHeader
        title={week.title}
        description={`Week ${week.week_number}${
          week.phases ? ` · Phase ${week.phases.phase_number}: ${week.phases.title}` : ""
        }`}
        action={
          myReport ? (
            <StatusPill tone="success">
              <CheckCircle2 className="size-3" />
              Submitted {formatDateTime(myReport.submitted_at)}
            </StatusPill>
          ) : (
            <StatusPill tone="warning">Not submitted</StatusPill>
          )
        }
      />
      <BackLink />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {reportLocked ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-[14px]">
                  <LockKeyhole className="size-4 text-muted-foreground" />
                  Report locked
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  The 7-day edit window ended {editDeadline.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  })} UTC.
                  Your submitted report remains available to you and your team leaders.
                </p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  A leader can still add feedback. Contact a team administrator if a correction is necessary.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ReportForm
              weekId={week.id}
              existing={myReport}
              submitted={Boolean(myReport)}
            />
          )}

          {/* If leader feedback exists, show it (read-only). */}
          {myReport?.leader_feedback ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-[14px]">
                  <MessageSquare className="size-4 text-muted-foreground" />
                  Leader feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-foreground">
                  {myReport.leader_feedback}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Week objectives reference */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <Target className="size-4 text-muted-foreground" />
                Week objectives
              </CardTitle>
            </CardHeader>
            <CardContent>
              {objectives.length > 0 ? (
                <ul className="space-y-1.5">
                  {objectives.map((o, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground"
                    >
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] italic text-muted-foreground">
                  No objectives defined for this week.
                </p>
              )}
              {week.overview ? (
                <>
                  <Separator className="my-3" />
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {week.overview}
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/weekly-reports"
      className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Back to weekly reports
    </Link>
  );
}

/** Read-only render of a member's report (for the leader view). */
function ReportReadonlyView({ report }: { report: ReportWithProfile }) {
  const topics = report.topics_completed ?? [];
  const exercises = report.exercises_completed ?? [];
  const assignments = report.assignments_completed ?? [];
  const links = report.github_links ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-[14px]">
          <FileText className="size-4 text-muted-foreground" />
          Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ReportField label="Member">
          <div className="flex items-center gap-2">
            <Avatar className="size-7 border border-border">
              <AvatarFallback className="bg-primary/10 text-[11px] font-medium text-primary">
                {initials(report.profiles?.full_name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <span className="text-[13px] font-medium">
              {report.profiles?.full_name ?? "Member"}
            </span>
          </div>
        </ReportField>

        <ReportField label="Hours spent">
          <span className="nums text-[13px]">{report.hours_spent}h</span>
        </ReportField>

        <ReportField label="What I learned">
          {report.learned ? (
            <Pre>{report.learned}</Pre>
          ) : (
            <Empty />
          )}
        </ReportField>

        <ReportField label="Topics completed">
          {topics.length > 0 ? (
            <List items={topics} />
          ) : (
            <Empty />
          )}
        </ReportField>

        <ReportField label="Exercises completed">
          {exercises.length > 0 ? <List items={exercises} /> : <Empty />}
        </ReportField>

        <ReportField label="Assignments completed">
          {assignments.length > 0 ? (
            <List items={assignments} />
          ) : (
            <Empty />
          )}
        </ReportField>

        <ReportField label="Biggest achievement">
          {report.biggest_achievement ? (
            <Pre>{report.biggest_achievement}</Pre>
          ) : (
            <Empty />
          )}
        </ReportField>

        <ReportField label="Main difficulty">
          {report.main_difficulty ? (
            <Pre>{report.main_difficulty}</Pre>
          ) : (
            <Empty />
          )}
        </ReportField>

        <ReportField label="Current blockers">
          {report.current_blockers ? (
            <Pre>{report.current_blockers}</Pre>
          ) : (
            <Empty />
          )}
        </ReportField>

        <ReportField label="Questions">
          {report.questions ? <Pre>{report.questions}</Pre> : <Empty />}
        </ReportField>

        <ReportField label="Next week goals">
          {report.next_week_goals ? (
            <Pre>{report.next_week_goals}</Pre>
          ) : (
            <Empty />
          )}
        </ReportField>

        <ReportField label="GitHub links">
          {links.length > 0 ? (
            <ul className="space-y-1">
              {links.map((l, i) => (
                <li key={i}>
                  <a
                    href={l}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] text-primary underline-offset-2 hover:underline break-all"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </ReportField>
      </CardContent>
    </Card>
  );
}

function ReportField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

function Empty() {
  return <span className="text-[12px] italic text-muted-foreground">—</span>;
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-[13px] leading-relaxed text-foreground">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
