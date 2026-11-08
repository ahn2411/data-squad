/**
 * Roadmap label maps.
 *
 * Extracted from queries.ts so client components (status-badges.tsx) can import
 * the label maps without pulling in the Supabase server client (which uses
 * `next/headers` and is server-only).
 */
import type {
  PhaseStatus,
  WeekStatus,
  PublicationStatus,
  TopicDifficulty,
  ResourceType,
} from "@/types/database";

export const phaseStatusLabels: Record<PhaseStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const weekStatusLabels: Record<WeekStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const publicationStatusLabels: Record<PublicationStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const topicDifficultyLabels: Record<TopicDifficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const resourceTypeLabels: Record<ResourceType, string> = {
  article: "Article",
  video: "Video",
  book: "Book",
  documentation: "Docs",
  course: "Course",
  tool: "Tool",
  other: "Other",
};
