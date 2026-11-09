import Link from "next/link";
import { ArrowRight, ChevronRight, Info, Map, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireActiveMember } from "@/features/auth/session";
import {
  getPhases,
  getWeeks,
  getTopics,
  getTopicProgressForUser,
  getWeekProgressForUser,
  getCurrentWeek,
  type WeekWithPhase,
} from "@/features/roadmap/queries";
import { PhaseStatusBadge } from "@/features/roadmap/status-badges";
import { formatDate, formatStudyTime, percent } from "@/lib/format";
import type { Phase, Topic, TopicProgress } from "@/types/database";

export const metadata = { title: "Learning roadmap" };

interface RoadmapPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function RoadmapPage({ searchParams }: RoadmapPageProps) {
  const { q: rawQuery } = await searchParams;
  const query = rawQuery?.trim().slice(0, 100) ?? "";
  const normalizedQuery = query.toLocaleLowerCase();
  const session = await requireActiveMember();
  const isLeaderOrAdmin =
    session.membership.role === "admin" || session.membership.role === "leader";

  // Fetch all the data. Wrap in try/catch so a Supabase hiccup renders an
  // actionable error message instead of a 500.
  let phases: Phase[] = [];
  let weeks: WeekWithPhase[] = [];
  let topics: Topic[] = [];
  let progress: TopicProgress[] = [];
  let weekProgress: Awaited<ReturnType<typeof getWeekProgressForUser>> = [];
  let currentWeekId: string | null = null;
  let fetchError: string | null = null;

  try {
    [phases, weeks, topics, progress, weekProgress] = await Promise.all([
      getPhases(),
      getWeeks(),
      getTopics(),
      getTopicProgressForUser(session.userId),
      getWeekProgressForUser(session.userId),
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
  const estimatedMinutesByWeek = new globalThis.Map<string, number>();
  for (const topic of topics) {
    if (topic.estimated_minutes && topic.estimated_minutes > 0) {
      estimatedMinutesByWeek.set(
        topic.week_id,
        (estimatedMinutesByWeek.get(topic.week_id) ?? 0) + topic.estimated_minutes,
      );
    }
  }
  const completedWeekIds = new Set(weeks.filter((week) => {
    const publishedTopics = topics.filter((topic) => topic.week_id === week.id && topic.publication_status === "published");
    if (publishedTopics.length === 0 || !publishedTopics.every((topic) => completedTopicIds.has(topic.id))) return false;
    const savedProgress = weekProgress.find((row) => row.week_id === week.id);
    const checkedDeliverables = savedProgress?.completed_deliverables ?? [];
    const checkedCriteria = savedProgress?.completed_criteria ?? [];
    return (week.deliverables ?? []).every((item) => checkedDeliverables.includes(item)) &&
      (week.completion_criteria ?? []).every((item) => checkedCriteria.includes(item));
  }).map((week) => week.id));

  const matchingTopicWeekIds = new Set(
    topics
      .filter((topic) => topic.title.toLocaleLowerCase().includes(normalizedQuery))
      .map((topic) => topic.week_id),
  );
  const matchingWeeksByPhase = new globalThis.Map<string, WeekWithPhase[]>();
  for (const week of weeks) {
    const phaseMatches = phases.some(
      (phase) => phase.id === week.phase_id &&
        `${phase.title} ${phase.description ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
    );
    const weekMatches = `${week.title} ${week.overview ?? ""}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
    if (!normalizedQuery || phaseMatches || weekMatches || matchingTopicWeekIds.has(week.id)) {
      const list = matchingWeeksByPhase.get(week.phase_id) ?? [];
      list.push(week);
      matchingWeeksByPhase.set(week.phase_id, list);
    }
  }
  const visiblePhases = normalizedQuery
    ? phases.filter((phase) => matchingWeeksByPhase.has(phase.id))
    : phases;
  const matchingWeekCount = normalizedQuery
    ? [...matchingWeeksByPhase.values()].reduce((total, items) => total + items.length, 0)
    : weeks.length;

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

      <form action="/roadmap" method="get" className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search phases, weeks, and topics…"
            aria-label="Search learning phases, weeks, and topics"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">Search roadmap</Button>
        {query ? <Button asChild type="button" variant="ghost"><Link href="/roadmap">Clear</Link></Button> : null}
      </form>
      {query ? (
        <p className="mb-4 text-[12px] text-muted-foreground" aria-live="polite">
          {matchingWeekCount} matching {matchingWeekCount === 1 ? "week" : "weeks"} across {visiblePhases.length} {visiblePhases.length === 1 ? "phase" : "phases"}.
        </p>
      ) : null}

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
        {visiblePhases.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-[13px] text-muted-foreground">No phases, weeks, or topics match “{query}”.</CardContent></Card>
        ) : visiblePhases.map((phase) => {
          const phaseWeeks = weeks.filter((week) => week.phase_id === phase.id);
          const visibleWeeks = matchingWeeksByPhase.get(phase.id) ?? [];
          const phaseWeekIds = new Set(phaseWeeks.map((w) => w.id));
          const phaseTopics = topics.filter((t) => phaseWeekIds.has(t.week_id));
          const completed = phaseTopics.filter((t) =>
            completedTopicIds.has(t.id),
          ).length;
          const completedPhaseWeeks = phaseWeeks.filter((week) => completedWeekIds.has(week.id)).length;
          const ratio = phaseWeeks.length > 0 ? completedPhaseWeeks / phaseWeeks.length : 0;

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
                    {completedPhaseWeeks}/{phaseWeeks.length} weeks complete · {completed}/{phaseTopics.length} topics
                  </p>
                </div>
              </header>

              {/* Weeks */}
              {visibleWeeks.length === 0 ? (
                <div className="p-4 text-[13px] text-muted-foreground sm:p-6">
                  No weeks in this phase yet.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {visibleWeeks.map((week) => {
                    const isCurrent = week.id === currentWeekId;
                    const weekTopicCount = topics.filter(
                      (t) => t.week_id === week.id,
                    ).length;
                    const studyTime = formatStudyTime(estimatedMinutesByWeek.get(week.id));
                    const weekCompleted = topics.filter(
                      (t) =>
                        t.week_id === week.id &&
                        completedTopicIds.has(t.id),
                    ).length;
                    const isComplete = completedWeekIds.has(week.id);
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
                              {studyTime ? ` · about ${studyTime}` : ""}
                              {weekCompleted > 0
                                ? ` · ${weekCompleted} completed`
                                : ""}
                              {isComplete ? " · Week complete" : ""}
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
