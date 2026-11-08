import Link from "next/link";
import {
  BookOpen,
  BookText,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  FileText,
  GraduationCap,
  ListChecks,
  PlayCircle,
  Target,
  Wrench,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DifficultyBadge,
  PublicationStatusBadge,
  TopicStatusPill,
  ResourceTypeBadge,
} from "./status-badges";
import { TopicProgressButton } from "./topic-progress-button";
import { type TopicWithResources } from "./queries";
import type { TopicProgress, TopicStatus } from "@/types/database";

const resourceIcons = {
  article: FileText,
  video: PlayCircle,
  book: BookText,
  documentation: BookOpen,
  course: GraduationCap,
  tool: Wrench,
  other: CircleHelp,
} as const;

interface TopicContentProps {
  topic: TopicWithResources;
  /** The current user's progress for this topic, or null. */
  progress: TopicProgress | null;
  /** Show the "Open standalone" link to /roadmap/topic/[id]. */
  showStandaloneLink?: boolean;
}

/**
 * Renders the full body of a topic (objectives, exercise, resources,
 * completion criteria) plus the deliberate-action progress button.
 *
 * Server component — the only interactivity lives in the client
 * <TopicProgressButton> child.
 */
export function TopicContent({
  topic,
  progress,
  showStandaloneLink = false,
}: TopicContentProps) {
  const status: TopicStatus | null = progress?.status ?? null;
  const objectives = topic.learning_objectives ?? [];
  const prerequisites = topic.prerequisites ?? [];
  const criteria = topic.completion_criteria ?? [];
  const resources = topic.learning_resources ?? [];
  const minutes = topic.estimated_minutes;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={topic.difficulty} />
        {status ? <TopicStatusPill status={status} /> : null}
        <PublicationStatusBadge status={topic.publication_status} />
        {minutes ? (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Clock className="size-3" />
            {minutes} min
          </Badge>
        ) : null}
        {showStandaloneLink ? (
          <Link
            href={`/roadmap/topic/${topic.id}`}
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Open standalone
            <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>

      {topic.description ? (
        <p className="text-[14px] leading-relaxed text-foreground">
          {topic.description}
        </p>
      ) : null}

      {/* Learning objectives */}
      {objectives.length > 0 ? (
        <section>
          <SectionTitle icon={Target}>Learning objectives</SectionTitle>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {objectives.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Prerequisites */}
      {prerequisites.length > 0 ? (
        <section>
          <SectionTitle icon={ListChecks}>Prerequisites</SectionTitle>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-muted-foreground">
            {prerequisites.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Practical exercise */}
      {topic.practical_exercise ? (
        <section className="rounded-lg border border-border bg-muted/30 p-4">
          <SectionTitle icon={Wrench}>Practical exercise</SectionTitle>
          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-foreground">
            {topic.practical_exercise}
          </p>
        </section>
      ) : null}

      {/* Resources */}
      {resources.length > 0 ? (
        <section>
          <SectionTitle icon={BookOpen}>Learning resources</SectionTitle>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {resources.map((r) => {
              const Icon = resourceIcons[r.resource_type] ?? CircleHelp;
              return (
                <li key={r.id}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {r.title}
                        </span>
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <ResourceTypeBadge type={r.resource_type} />
                        {r.is_free ? (
                          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                            Free
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                            Paid
                          </Badge>
                        )}
                      </div>
                      {r.description ? (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                          {r.description}
                        </p>
                      ) : null}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Completion criteria */}
      {criteria.length > 0 ? (
        <section>
          <SectionTitle icon={ListChecks}>Completion criteria</SectionTitle>
          <ul className="mt-2 space-y-1.5">
            {criteria.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Action row */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <p className="text-[12px] text-muted-foreground">
          {status === "completed"
            ? "You completed this topic."
            : status === "in_progress"
              ? "Mark complete when you've met the criteria above."
              : "Start when you're ready. Completion is deliberate."}
        </p>
        <TopicProgressButton topicId={topic.id} status={status} compact />
      </div>
    </div>
  );
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

/** A standalone full-page topic card (for /roadmap/topic/[id]). */
export function TopicFullCard({
  topic,
  progress,
}: {
  topic: TopicWithResources;
  progress: TopicProgress | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[18px] tracking-tight">{topic.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <TopicContent topic={topic} progress={progress} />
      </CardContent>
    </Card>
  );
}
