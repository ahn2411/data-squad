import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Package,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { requireActiveMember } from "@/features/auth/session";
import {
  getWeekDetail,
  getTopicProgressForUser,
  getWeekProgressForUser,
  type WeekDetail,
} from "@/features/roadmap/queries";
import { WeekStatusBadge } from "@/features/roadmap/status-badges";
import { TopicContent } from "@/features/roadmap/topic-content";
import { formatDate, formatStudyTime, percent } from "@/lib/format";
import type { TopicProgress } from "@/types/database";
import { WeekDeliverablesChecklist } from "@/features/roadmap/week-deliverables-checklist";

export const metadata = { title: "Week" };

interface PageProps {
  params: Promise<{ weekId: string }>;
}

export default async function WeekDetailPage({ params }: PageProps) {
  const { weekId } = await params;
  const session = await requireActiveMember();

  let week: WeekDetail | null = null;
  let progress: TopicProgress[] = [];
  let weekProgress: Awaited<ReturnType<typeof getWeekProgressForUser>> = [];
  let fetchError: string | null = null;
  try {
    [week, progress, weekProgress] = await Promise.all([
      getWeekDetail(weekId),
      getTopicProgressForUser(session.userId),
      getWeekProgressForUser(session.userId),
    ]);
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Could not load this week.";
  }

  if (fetchError) {
    return (
      <>
        <BackLink />
        <Alert variant="destructive">
          <AlertTitle>Could not load this week</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      </>
    );
  }

  if (!week) {
    notFound();
  }

  const completedTopicIds = new Set(
    progress
      .filter((p) => p.status === "completed")
      .map((p) => p.topic_id),
  );
  const total = week.topics.length;
  const estimatedMinutes = week.topics.reduce(
    (sum, topic) => sum + (topic.estimated_minutes && topic.estimated_minutes > 0 ? topic.estimated_minutes : 0),
    0,
  );
  const estimatedStudyTime = formatStudyTime(estimatedMinutes);
  const completed = week.topics.filter((t) =>
    completedTopicIds.has(t.id),
  ).length;
  const requiredTopics = week.topics.filter((topic) => topic.publication_status === "published");
  const requiredTopicsCompleted = requiredTopics.filter((topic) => completedTopicIds.has(topic.id)).length;
  const objectives = week.objectives ?? [];
  const deliverables = week.deliverables ?? [];
  const savedWeekProgress = weekProgress.find((entry) => entry.week_id === week.id);
  const completedDeliverables = savedWeekProgress?.completed_deliverables ?? [];
  const completedCriteria = savedWeekProgress?.completed_criteria ?? [];
  const allTopicsComplete = requiredTopics.length > 0 && requiredTopicsCompleted === requiredTopics.length;
  const allDeliverablesComplete = deliverables.every((item) => completedDeliverables.includes(item));
  const criteria = week.completion_criteria ?? [];
  const allCriteriaComplete = criteria.every((item) => completedCriteria.includes(item));
  const weekComplete = allTopicsComplete && allDeliverablesComplete && allCriteriaComplete;
  const requirementsTotal = requiredTopics.length + deliverables.length + criteria.length;
  const requirementsDone = requiredTopicsCompleted + deliverables.filter((item) => completedDeliverables.includes(item)).length + criteria.filter((item) => completedCriteria.includes(item)).length;
  const weekRatio = requirementsTotal > 0 ? requirementsDone / requirementsTotal : 0;

  const phaseName = week.phases?.title ?? "Phase";
  const phaseNumber = week.phases?.phase_number ?? null;

  return (
    <>
      <PageHeader
        title={week.title}
        description={`Week ${week.week_number}${phaseNumber ? ` · Phase ${phaseNumber}: ${phaseName}` : ` · ${phaseName}`}`}
        action={<WeekStatusBadge status={week.status} />}
      />

      <BackLink />

      {/* Overview + objectives + progress */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-4 sm:p-6">
            {week.overview ? (
              <p className="text-[14px] leading-relaxed text-foreground">
                {week.overview}
              </p>
            ) : (
              <p className="text-[13px] italic text-muted-foreground">
                No overview provided for this week.
              </p>
            )}

            {estimatedStudyTime ? (
              <p className="text-[12px] text-muted-foreground">
                Estimated study time: about {estimatedStudyTime}
              </p>
            ) : null}

            {objectives.length > 0 ? (
              <section>
                <SectionTitle icon={Target}>Weekly objectives</SectionTitle>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
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
              </section>
            ) : null}

            {deliverables.length > 0 || criteria.length > 0 ? (
              <section>
                <SectionTitle icon={Package}>Week requirements</SectionTitle>
                <WeekDeliverablesChecklist
                  weekId={week.id}
                  deliverables={deliverables}
                  criteria={criteria}
                  initiallyCompleted={completedDeliverables}
                  initiallyCompletedCriteria={completedCriteria}
                />
              </section>
            ) : null}
          </CardContent>
        </Card>

        {/* Progress sidebar */}
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Your progress
            </p>
            <div className="flex items-baseline gap-2">
              <span className="nums text-[22px] font-semibold text-foreground">
                {requirementsDone}
              </span>
              <span className="text-[13px] text-muted-foreground">
                / {requirementsTotal} learning requirements complete
              </span>
            </div>
            <Progress value={weekRatio * 100} className="h-2" />
            <p className="text-[12px] text-muted-foreground">
              {percent(weekRatio)} complete{weekComplete ? " · Week complete" : ""}
            </p>
            {week.start_date || week.end_date ? (
              <div className="border-t border-border pt-3 text-[12px] text-muted-foreground">
                {week.start_date ? (
                  <p>
                    Starts <span className="nums">{formatDate(week.start_date)}</span>
                  </p>
                ) : null}
                {week.end_date ? (
                  <p>
                    Ends <span className="nums">{formatDate(week.end_date)}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Topics */}
      <div className="space-y-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Topics in this week
        </h2>
        {total === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-[13px] text-muted-foreground">
              No topics have been added to this week yet.
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {week.topics.map((topic, idx) => {
              const tp = progress.find((p) => p.topic_id === topic.id) ?? null;
              const isCompleted = tp?.status === "completed";
              return (
                <AccordionItem
                  key={topic.id}
                  value={topic.id}
                  className="rounded-xl border border-border bg-card px-4 last:border-b sm:px-6"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-4 text-left">
                      <span
                        className={`nums flex size-7 shrink-0 items-center justify-center rounded-md text-[12px] font-semibold ${
                          isCompleted
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[14px] font-medium text-foreground">
                            {topic.title}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                          {topic.difficulty}
                          {topic.estimated_minutes
                            ? ` · ${topic.estimated_minutes} min`
                            : ""}
                          {tp ? ` · ${labelForStatus(tp.status)}` : ""}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <TopicContent topic={topic} progress={tp} showStandaloneLink />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </>
  );
}

function labelForStatus(status: string): string {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in progress";
  if (status === "locked") return "locked";
  return "available";
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </h3>
  );
}

function BackLink() {
  return (
    <Link
      href="/roadmap"
      className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Back to roadmap
    </Link>
  );
}
