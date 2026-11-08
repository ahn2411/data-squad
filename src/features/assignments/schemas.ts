import { z } from "zod";
import type {
  AssignmentType,
  AssignmentDifficulty,
  SubmissionType,
  PublicationStatus,
} from "@/types/database";

/**
 * Zod schemas for the assignments feature.
 * jsonb string-array columns (supporting_resources, deliverables,
 * evaluation_criteria) are typed as string[].
 */

export const ASSIGNMENT_TYPES: AssignmentType[] = [
  "programming_exercise",
  "written_explanation",
  "research_activity",
  "data_analysis",
  "quiz",
  "mini_project",
  "group_project",
];

export const ASSIGNMENT_DIFFICULTIES: AssignmentDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
];

export const SUBMISSION_TYPES: SubmissionType[] = [
  "github_repo",
  "github_pr",
  "github_commit",
  "external_url",
  "written",
  "document",
  "image",
  "file",
];

export const PUBLICATION_STATUSES: PublicationStatus[] = [
  "draft",
  "published",
  "archived",
];

const urlString = z
  .string()
  .max(2048)
  .refine(
    (v) => v === "" || /^https?:\/\/[^\s]+$/.test(v),
    "Enter a valid URL starting with http:// or https://",
  );

const stringList = z.array(z.string().max(500)).max(50);

/** Shared field set between create & update. */
const assignmentFields = {
  title: z
    .string()
    .min(1, "Title is required")
    .max(160, "Title is too long (max 160)"),
  description: z.string().max(2000).optional().or(z.literal("")),
  instructions: z.string().max(8000).optional().or(z.literal("")),
  assignment_type: z.enum(ASSIGNMENT_TYPES as [AssignmentType, ...AssignmentType[]]),
  difficulty: z.enum(ASSIGNMENT_DIFFICULTIES as [AssignmentDifficulty, ...AssignmentDifficulty[]]),
  phase_id: z.string().uuid().nullable().optional(),
  week_id: z.string().uuid().nullable().optional(),
  topic_id: z.string().uuid().nullable().optional(),
  deadline: z.string().nullable().optional(),
  max_score: z
    .number()
    .int("Max score must be an integer")
    .min(0, "Max score cannot be negative")
    .max(1000, "Max score is too large")
    .nullable()
    .optional(),
  required_submission_type: z
    .enum(SUBMISSION_TYPES as [SubmissionType, ...SubmissionType[]])
    .nullable()
    .optional(),
  supporting_resources: stringList.default([]),
  deliverables: stringList.default([]),
  evaluation_criteria: stringList.default([]),
  recipientUserIds: z.array(z.string().uuid()).default([]),
  publication_status: z.enum(PUBLICATION_STATUSES as [PublicationStatus, ...PublicationStatus[]]).default("draft"),
};

export const createAssignmentSchema = z.object(assignmentFields);

export type CreateAssignmentValues = z.infer<typeof createAssignmentSchema>;

export const updateAssignmentSchema = z.object({
  ...assignmentFields,
  id: z.string().uuid(),
});

export type UpdateAssignmentValues = z.infer<typeof updateAssignmentSchema>;

export const publishAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  recipientUserIds: z.array(z.string().uuid()).default([]),
});

export type PublishAssignmentValues = z.infer<typeof publishAssignmentSchema>;

export const assignmentIdSchema = z.object({
  assignmentId: z.string().uuid(),
});

export type AssignmentIdValues = z.infer<typeof assignmentIdSchema>;

/** Member-side filter for the assignment list. */
export const assignmentFilterSchema = z.object({
  status: z
    .enum(["all", "pending", "submitted", "approved", "overdue"])
    .default("all"),
  search: z.string().trim().max(120).default(""),
});

export type AssignmentFilterValues = z.infer<typeof assignmentFilterSchema>;

/** Admin-side filter. */
export const adminAssignmentFilterSchema = z.object({
  status: z.enum(["all", "draft", "published", "archived"]).default("all"),
  search: z.string().trim().max(120).default(""),
});

export type AdminAssignmentFilterValues = z.infer<
  typeof adminAssignmentFilterSchema
>;

/** Helper: validate a URL string (returns true/false, no throw). */
export function isValidUrl(value: string): boolean {
  return value === "" || /^https?:\/\/[^\s]+$/.test(value);
}

export { urlString };
