import { StatusPill } from "@/components/status-pill";
import type {
  PhaseStatus,
  WeekStatus,
  PublicationStatus,
  TopicStatus,
  TopicDifficulty,
  ResourceType,
} from "@/types/database";
import {
  phaseStatusLabels,
  weekStatusLabels,
  publicationStatusLabels,
  topicDifficultyLabels,
  resourceTypeLabels,
} from "./labels";

/**
 * Small badge helpers backed by the shared StatusPill component so roadmap
 * statuses use the same visual language as role/membership pills.
 */

const draftTone = "warning" as const;
const publishedTone = "success" as const;
const archivedTone = "muted" as const;

export function PhaseStatusBadge({ status }: { status: PhaseStatus }) {
  const tone =
    status === "published"
      ? publishedTone
      : status === "draft"
        ? draftTone
        : archivedTone;
  return <StatusPill tone={tone}>{phaseStatusLabels[status]}</StatusPill>;
}

export function WeekStatusBadge({ status }: { status: WeekStatus }) {
  const tone =
    status === "published"
      ? publishedTone
      : status === "draft"
        ? draftTone
        : archivedTone;
  return <StatusPill tone={tone}>{weekStatusLabels[status]}</StatusPill>;
}

export function PublicationStatusBadge({
  status,
}: {
  status: PublicationStatus;
}) {
  const tone =
    status === "published"
      ? publishedTone
      : status === "draft"
        ? draftTone
        : archivedTone;
  return <StatusPill tone={tone}>{publicationStatusLabels[status]}</StatusPill>;
}

const topicStatusConfig: Record<
  TopicStatus,
  { tone: "muted" | "navy" | "success"; label: string }
> = {
  locked: { tone: "muted", label: "Locked" },
  available: { tone: "navy", label: "Available" },
  in_progress: { tone: "navy", label: "In progress" },
  completed: { tone: "success", label: "Completed" },
};

export function TopicStatusPill({ status }: { status: TopicStatus }) {
  const c = topicStatusConfig[status];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

const difficultyConfig: Record<
  TopicDifficulty,
  { tone: "muted" | "warning" | "danger"; label: string }
> = {
  beginner: { tone: "muted", label: "Beginner" },
  intermediate: { tone: "warning", label: "Intermediate" },
  advanced: { tone: "danger", label: "Advanced" },
};

export function DifficultyBadge({ difficulty }: { difficulty: TopicDifficulty }) {
  const c = difficultyConfig[difficulty];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

export function ResourceTypeBadge({ type }: { type: ResourceType }) {
  return (
    <StatusPill tone="muted">{resourceTypeLabels[type]}</StatusPill>
  );
}
