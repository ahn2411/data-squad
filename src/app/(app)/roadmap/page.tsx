import Link from "next/link";
import { ArrowRight, ChevronRight, Info, Map, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireActiveMember } from "@/features/auth/session";
import {
  getPhases,
  getWeeks,
  getTopics,
  getTopicProgressForUser,
  getCurrentWeek,
  type WeekWithPhase,
} from "@/features/roadmap/queries";
import { PhaseStatusBadge } from "@/features/roadmap/status-badges";
import { formatDate, percent } from "@/lib/format";
import type { Phase, Topic, TopicProgress } from "@/types/database";

export const metadata = { title: "Learning roadmap" };

export default async function RoadmapPage() {
  const session = await requireActiveMember();
  const isLeaderOrAdmin =
    session.membership.role === "admin" || session.membership.role === "leader";

  // Fetch all the data. Wrap in try/catch so a Supabase hiccup renders an
  // actionable error message instead of a 500.
  let phases: Phase[] = [];
  let weeks: WeekWithPhase[] = [];
  let topics: Topic[] = [];
  let progress: TopicProgress[] = [];
  let currentWeekId: string | null = null;
  let fetchError: string | null = null;

  try {
    [phases, weeks, topics, progress] = await Promise.all([
      getPhases(),
      getWeeks(),
      getTopics(),
      getTopicProgressForUser(session.userId),
    ]);
    const currentWeek = await getCurrentWeek(session.membership.team_id);
    currentWeekId = currentWeek?.id ?? null;
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Could not load the roadmap right now.";
  }

  if (fetchError) {
    return (
      <>
        <PageHeader
          title="Learning roadmap"
          description="The 24-week Data Science curriculum, phase by phase."
        />
        <Alert variant="destructive">
          <Info className="size-4" />
          <AlertTitle>Could not load the roadmap</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      </>
    );
  }

  // Empty states.
  if (phases.length === 0) {
    return (
      <>
        <PageHeader
          title="Learning roadmap"
          description="The 24-week Data Science curriculum, phase by phase."
          action={
            isLeaderOrAdmin ? (
              <Button asChild size="sm">
                <Link href="/admin/roadmap">
                  <Sparkles className="size-4" />
                  Manage roadmap
                </Link>
              </Button>
            ) : undefined
          }
        />
        <EmptyState isLeaderOrAdmin={isLeaderOrAdmin} />
      </>
    );
  }

  const completedTopicIds = new Set(
    progress
      .filter((p) => p.status === "completed")
      .map((p) => p.topic_id),
  );
  const inProgressTopicIds = new Set(
    progress
      .filter((p) => p.status === "in_progress")
      .map((p) => p.topic_id),
  );

  const totalCompleted = topics.filter((t) => completedTopicIds.has(t.id)).length;
  const overallRatio = topics.length > 0 ? totalCompleted / topics.length : 0;

  return (
    <>
      <PageHeader
        title="Learning roadmap"
        description="The 24-week Data Science curriculum, phase by phase."
        action={
          isLeaderOrAdmin ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/roadmap">
                <Sparkles className="size-4" />
                Manage roadmap
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Overall progress summary */}
      <Card className="mb-6 overflow-hidden">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Overall progress
              </span>
              <span className="nums text-[13px] font-medium text-foreground">
                {totalCompleted}/{topics.length} topics
              </span>
            </div>
            <Progress value={overallRatio * 100} className="h-2" />
            <p className="text-[12px] text-muted-foreground">
              {percent(overallRatio)} complete ·{" "}
              {inProgressTopicIds.size} in progress
            </p>
          </div>
          <div className="hidden sm:block">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Map className="size-4" />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Phases */}
      <div className="space-y-6">
        {phases.map((phase) => {
          const phaseWeeks = weeks.filter((w) => w.phase_id === phase.id);
          const phaseWeekIds = new Set(phaseWeeks.map((w) => w.id));
          const phaseTopics = topics.filter((t) => phaseWeekIds.has(t.week_id));
          const completed = phaseTopics.filter((t) =>
            completedTopicIds.has(t.id),
          ).length;
          const ratio =
            phaseTopics.length > 0 ? completed / phaseTopics.length : 0;

          return (
            <section
              key={phase.id}
              className="rounded-xl border border-border bg-card"
            >
              <header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="nums inline-flex size-6 items-center justify-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                      {phase.phase_number}
                    </span>
                    <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                      {phase.title}
                    </h2>
                    <PhaseStatusBadge status={phase.status} />
                  </div>
                  {phase.description ? (
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      {phase.description}
                    </p>
                  ) : null}
                  <p className="text-[12px] text-muted-foreground">
                    Weeks {phase.start_week}–{phase.end_week} ·{" "}
                    {phaseWeeks.length}{" "}
                    {phaseWeeks.length === 1 ? "week" : "weeks"} ·{" "}
                    {phaseTopics.length}{" "}
                    {phaseTopics.length === 1 ? "topic" : "topics"}
                  </p>
                </div>
                <div className="w-full sm:w-48 sm:shrink-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground">
                      Progress
                    </span>
                    <span className="nums text-[12px] font-medium text-foreground">
                      {percent(ratio)}
                    </span>
                  </div>
                  <Progress value={ratio * 100} className="mt-1.5 h-1.5" />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {completed}/{phaseTopics.length} completed
                  </p>
                </div>
              </header>

              {/* Weeks */}
              {phaseWeeks.length === 0 ? (
                <div className="p-4 text-[13px] text-muted-foreground sm:p-6">
                  No weeks in this phase yet.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {phaseWeeks.map((week) => {
                    const isCurrent = week.id === currentWeekId;
                    const weekTopicCount = topics.filter(
                      (t) => t.week_id === week.id,
                    ).length;
                    const weekCompleted = topics.filter(
                      (t) =>
                        t.week_id === week.id &&
                        completedTopicIds.has(t.id),
                    ).length;
                    return (
                      <li key={week.id}>
                        <Link
                          href={`/roadmap/${week.id}`}
                          className="group flex items-center gap-3 p-4 transition-colors hover:bg-accent/50 sm:p-5"
                        >
                          <span className="nums flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-[12px] font-semibold text-muted-foreground group-hover:border-primary/40 group-hover:text-primary">
                            {week.week_number}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[14px] font-medium text-foreground">
                                {week.title}
                              </span>
                              {isCurrent ? (
                                <span className="rounded bg-primary/10 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-primary">
                                  Current
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                              {weekTopicCount}{" "}
                              {weekTopicCount === 1 ? "topic" : "topics"}
                              {weekCompleted > 0
                                ? ` · ${weekCompleted} completed`
                                : ""}
                              {week.start_date
                                ? ` · starts ${formatDate(week.start_date)}`
                                : ""}
                            </p>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function EmptyState({ isLeaderOrAdmin }: { isLeaderOrAdmin: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Map className="size-5" />
        </span>
        <div>
          <p className="text-[14px] font-medium text-foreground">
            No roadmap published yet
          </p>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            {isLeaderOrAdmin
              ? "Create the first phase of your curriculum. Phases hold weeks, weeks hold topics — once published, members see them here."
              : "Ask a leader to publish the curriculum. You'll see phases, weeks, and topics here once they're live."}
          </p>
        </div>
        {isLeaderOrAdmin ? (
          <Button asChild size="sm" className="mt-1">
            <Link href="/admin/roadmap">
              Open roadmap manager
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
