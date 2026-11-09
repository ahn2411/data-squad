import Link from "next/link";
import { ArrowRight, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusPill } from "@/components/status-pill";
import {
  getWeeksForReport,
  getMyReportStubs,
  getAllReports,
  getMissingReportMembers,
} from "@/features/reports/queries";
import { getMembers } from "@/features/members/queries";
import { formatDate } from "@/lib/format";
import { ReportsTable } from "./reports-table";

export const metadata = { title: "Weekly reports" };

interface PageProps {
  searchParams: Promise<{ week?: string; user?: string; q?: string; page?: string }>;
}

export default async function WeeklyReportsPage({ searchParams }: PageProps) {
  const session = await requireActiveMember();
  const isLeader =
    session.membership.role === "admin" ||
    session.membership.role === "leader";

  const sp = await searchParams;
  const weekFilter = typeof sp.week === "string" ? sp.week : undefined;
  const userFilter = typeof sp.user === "string" ? sp.user : undefined;
  const searchFilter = typeof sp.q === "string" ? sp.q.slice(0, 120) : undefined;
  const requestedPage = typeof sp.page === "string" && /^\d+$/.test(sp.page) ? Number(sp.page) : 1;

  let weeks: Awaited<ReturnType<typeof getWeeksForReport>> = [];
  let myStubs: Awaited<ReturnType<typeof getMyReportStubs>> = [];
  let loadError: string | null = null;
  try {
    [weeks, myStubs] = await Promise.all([
      getWeeksForReport(),
      getMyReportStubs(),
    ]);
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Could not load weekly reports.";
  }

  if (loadError) {
    return (
      <>
        <PageHeader
          title="Weekly reports"
          description="Reflect on what you learned each week and surface blockers for the squad."
        />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </>
    );
  }

  // Leader/admin branch: full team reports table.
  if (isLeader) {
    let reportPage: Awaited<ReturnType<typeof getAllReports>> = { reports: [], totalCount: 0, page: 1, pageSize: 20 };
    let members: Awaited<ReturnType<typeof getMembers>> = [];
    let missingMembers: Awaited<ReturnType<typeof getMissingReportMembers>> = [];
    const selectedReportWeek = weeks.find((week) => week.id === weekFilter) ?? null;
    let teamError: string | null = null;
    try {
      [reportPage, members, missingMembers] = await Promise.all([
        getAllReports({
          weekId: weekFilter,
          userId: userFilter,
          search: searchFilter,
        }, requestedPage),
        getMembers(),
        selectedReportWeek ? getMissingReportMembers(selectedReportWeek.id) : Promise.resolve([]),
      ]);
    } catch (err) {
      teamError =
        err instanceof Error ? err.message : "Could not load team reports.";
    }

    if (teamError) {
      return (
        <>
          <PageHeader
            title="Weekly reports"
            description="Reflect on what you learned each week and surface blockers for the squad."
          />
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{teamError}</AlertDescription>
          </Alert>
        </>
      );
    }

    const activeMembers = members.filter(
      (m) => m.membership_status === "active",
    );

    return (
      <>
        <PageHeader
          title="Weekly reports"
          description="Review what the squad worked on this week and add leader feedback."
          action={
            <Badge variant="outline" className="text-[12px] font-normal text-muted-foreground">
              Leader view · team reports
            </Badge>
          }
        />

        {/* "Your reports" quick access */}
        {weeks.length > 0 ? (
          <Card className="mb-6">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <FileText className="size-3.5" />
                Your reports
              </div>
              <div className="flex flex-wrap gap-2">
                {weeks.map((week) => {
                  const stub = myStubs.find((s) => s.week_id === week.id);
                  const submitted = Boolean(stub);
                  return (
                    <Link
                      key={week.id}
                      href={`/weekly-reports/${week.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <span className="nums text-muted-foreground">W{week.week_number}</span>
                      <span className="truncate max-w-[160px]">{week.title}</span>
                      {submitted ? (
                        <CheckCircle2 className="size-3.5 text-success" />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">write</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {selectedReportWeek ? (
          <Card className="mb-5">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[14px] font-semibold text-foreground">
                  Missing reports · Week {selectedReportWeek.week_number}
                </h2>
                <span className="nums text-[12px] text-muted-foreground">
                  {missingMembers.length} of {activeMembers.length} active members
                </span>
              </div>
              {missingMembers.length ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-2">
                  {missingMembers.map((member) => (
                    <li key={member.userId}>
                      <Link href={`/admin/members/${member.userId}`} className="text-[12px] text-primary hover:underline">
                        {member.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-muted-foreground">Every active member has submitted a report for this week.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <p className="mb-3 text-[12px] text-muted-foreground">
            Select a week in the report filters below to see active members who have not submitted yet.
          </p>
        )}

        <ReportsTable
          reportPage={reportPage}
          weeks={weeks}
          members={activeMembers.map((m) => ({
            id: m.user_id,
            name: m.profiles?.full_name ?? "Member",
          }))}
          weekFilter={weekFilter}
          userFilter={userFilter}
          searchFilter={searchFilter}
        />
      </>
    );
  }

  // Member branch.
  const submittedByWeek = new Map(myStubs.map((s) => [s.week_id, s]));

  return (
    <>
      <PageHeader
        title="Weekly reports"
        description="Reflect on what you learned each week and surface blockers for the squad."
      />

      {weeks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <FileText className="size-6 text-muted-foreground" />
            <p className="mt-2 text-[14px] font-medium text-foreground">
              No published weeks yet
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Weekly reports open up once a leader publishes the roadmap.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {weeks.map((week) => {
            const myStub = submittedByWeek.get(week.id);
            const submitted = Boolean(myStub);
            const phaseLabel = week.phases
              ? `Phase ${week.phases.phase_number}: ${week.phases.title}`
              : "Phase";
            return (
              <Card key={week.id} className="overflow-hidden">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="nums inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[12px] font-semibold text-muted-foreground">
                        {week.week_number}
                      </span>
                      <h3 className="truncate text-[14px] font-semibold text-foreground">
                        {week.title}
                      </h3>
                      {submitted ? (
                        <StatusPill tone="success">Submitted</StatusPill>
                      ) : (
                        <StatusPill tone="warning">Not submitted</StatusPill>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      {phaseLabel}
                      {week.start_date || week.end_date
                        ? ` · ${formatDate(week.start_date)} – ${formatDate(week.end_date)}`
                        : ""}
                      {submitted && myStub ? (
                        <> · last updated {formatDate(myStub.updated_at)}</>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/weekly-reports/${week.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      {submitted ? (
                        <>
                          <CheckCircle2 className="size-4 text-success" />
                          View / edit
                        </>
                      ) : (
                        <>
                          <FileText className="size-4" />
                          Write report
                        </>
                      )}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
