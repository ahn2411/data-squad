import { z } from "zod";
import type {
  BlockerPriority,
  BlockerStatus,
} from "@/types/database";

export const BLOCKER_PRIORITIES: BlockerPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const BLOCKER_STATUSES: BlockerStatus[] = [
  "open",
  "being_addressed",
  "resolved",
];

const urlString = z
  .string()
  .max(2048)
  .refine(
    (v) => v === "" || /^https?:\/\/[^\s]+$/.test(v),
    "Enter a valid URL starting with http:// or https://",
  );

/** Schema for creating a new blocker (current user is the reporter). */
export const createBlockerSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(160, "Title is too long (max 160)"),
  description: z.string().max(4000).optional().or(z.literal("")),
  topicId: z.string().uuid().nullable().optional(),
  assignmentId: z.string().uuid().nullable().optional(),
  errorMessages: z.string().max(8000).optional().or(z.literal("")),
  codeUrl: urlString.optional().or(z.literal("")),
  priority: z
    .enum(BLOCKER_PRIORITIES as [BlockerPriority, ...BlockerPriority[]])
    .default("medium"),
});

export type CreateBlockerValues = z.infer<typeof createBlockerSchema>;

/** Schema for a leader/admin updating a blocker's status & helper. */
export const updateBlockerStatusSchema = z.object({
  status: z.enum(BLOCKER_STATUSES as [BlockerStatus, ...BlockerStatus[]]),
  assignedHelper: z.string().uuid().nullable().optional(),
  resolutionNotes: z.string().max(4000).optional().or(z.literal("")),
});

export type UpdateBlockerStatusValues = z.infer<typeof updateBlockerStatusSchema>;

/** Schema for the owner updating their own blocker (editable fields only). */
export const updateOwnBlockerSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(160, "Title is too long (max 160)"),
  description: z.string().max(4000).optional().or(z.literal("")),
  topicId: z.string().uuid().nullable().optional(),
  assignmentId: z.string().uuid().nullable().optional(),
  errorMessages: z.string().max(8000).optional().or(z.literal("")),
  codeUrl: urlString.optional().or(z.literal("")),
  priority: z
    .enum(BLOCKER_PRIORITIES as [BlockerPriority, ...BlockerPriority[]])
    .default("medium"),
});

export type UpdateOwnBlockerValues = z.infer<typeof updateOwnBlockerSchema>;

/** Schema for creating a blocker comment. */
export const createCommentSchema = z.object({
  body: z
    .string()
    .min(1, "Comment can't be empty")
    .max(4000, "Comment is too long (max 4000)"),
});

export type CreateCommentValues = z.infer<typeof createCommentSchema>;

/** Admin/leader-side filter for the blockers table. */
export const blockerFilterSchema = z.object({
  status: z
    .enum(["all", "open", "being_addressed", "resolved"])
    .default("all"),
  priority: z
    .enum(["all", "low", "medium", "high", "critical"])
    .default("all"),
  search: z.string().trim().max(120).default(""),
});

export type BlockerFilterValues = z.infer<typeof blockerFilterSchema>;
