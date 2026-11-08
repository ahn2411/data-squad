import { z } from "zod";
import type {
  PhaseStatus,
  WeekStatus,
  TopicDifficulty,
  PublicationStatus,
  ResourceType,
} from "@/types/database";

/**
 * Roadmap admin/validation schemas.
 *
 * The enum literals below mirror the string-union types in @/types/database
 * (PhaseStatus, WeekStatus, TopicDifficulty, PublicationStatus, ResourceType).
 * They are kept as literal arrays so the inferred Zod types line up with the
 * database types without any `as any` casts.
 *
 * No `.transform()` or `z.coerce.*` is used: the input type and output type
 * are identical so react-hook-form + zodResolver see the same shape on both
 * sides. The action layer performs any "" → null cleanup before writing to
 * Supabase. Form inputs convert strings → numbers via onChange handlers.
 */

export const phaseStatusSchema = z.enum(["draft", "published", "archived"]);
export const weekStatusSchema = z.enum(["draft", "published", "archived"]);
export const publicationStatusSchema = z.enum(["draft", "published", "archived"]);
export const topicDifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export const resourceTypeSchema = z.enum([
  "article",
  "video",
  "book",
  "documentation",
  "course",
  "tool",
  "other",
]);

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugMessage = "Use lowercase letters, numbers, and hyphens (e.g. week-1-intro).";

const optionalString = z
  .string()
  .max(2000, "Too long")
  .optional()
  .or(z.literal(""));

const optionalDate = z
  .string()
  .max(20, "Too long")
  .optional()
  .or(z.literal(""));

const stringList = z.array(z.string());

// Required positive integer.
const positiveInt = z.number().int().min(1);
const nonNegInt = z.number().int().min(0);
// Optional positive integer (nullable). "" or null → no estimate.
const optionalMinutes = z.number().int().min(1).nullable().optional();

// ────────────────────────────── Phase ──────────────────────────────
export const savePhaseSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(140, "Title is too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(140, "Slug is too long")
    .regex(slugRegex, slugMessage),
  description: optionalString,
  phaseNumber: positiveInt,
  startWeek: positiveInt,
  endWeek: positiveInt,
  status: phaseStatusSchema,
  displayOrder: nonNegInt,
});
export type SavePhaseValues = z.infer<typeof savePhaseSchema>;

export const publishPhaseSchema = z.object({
  id: z.string().uuid(),
  status: phaseStatusSchema,
});
export type PublishPhaseValues = z.infer<typeof publishPhaseSchema>;

export const deletePhaseSchema = z.object({ id: z.string().uuid() });
export type DeletePhaseValues = z.infer<typeof deletePhaseSchema>;

// ────────────────────────────── Week ──────────────────────────────
export const saveWeekSchema = z.object({
  id: z.string().uuid().optional(),
  phaseId: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(140, "Title is too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(140, "Slug is too long")
    .regex(slugRegex, slugMessage),
  overview: optionalString,
  objectives: stringList,
  deliverables: stringList,
  completionCriteria: stringList,
  weekNumber: positiveInt,
  startDate: optionalDate,
  endDate: optionalDate,
  status: weekStatusSchema,
  displayOrder: nonNegInt,
});
export type SaveWeekValues = z.infer<typeof saveWeekSchema>;

export const publishWeekSchema = z.object({
  id: z.string().uuid(),
  status: weekStatusSchema,
});
export type PublishWeekValues = z.infer<typeof publishWeekSchema>;

export const deleteWeekSchema = z.object({ id: z.string().uuid() });
export type DeleteWeekValues = z.infer<typeof deleteWeekSchema>;

// ────────────────────────────── Topic ──────────────────────────────
export const saveTopicSchema = z.object({
  id: z.string().uuid().optional(),
  weekId: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(140, "Title is too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(140, "Slug is too long")
    .regex(slugRegex, slugMessage),
  description: optionalString,
  learningObjectives: stringList,
  prerequisites: stringList,
  completionCriteria: stringList,
  practicalExercise: optionalString,
  estimatedMinutes: optionalMinutes,
  difficulty: topicDifficultySchema,
  publicationStatus: publicationStatusSchema,
  displayOrder: nonNegInt,
});
export type SaveTopicValues = z.infer<typeof saveTopicSchema>;

export const publishTopicSchema = z.object({
  id: z.string().uuid(),
  status: publicationStatusSchema,
});
export type PublishTopicValues = z.infer<typeof publishTopicSchema>;

export const deleteTopicSchema = z.object({ id: z.string().uuid() });
export type DeleteTopicValues = z.infer<typeof deleteTopicSchema>;

// ────────────────────────────── Learning resource ──────────────────────────────
export const saveResourceSchema = z.object({
  id: z.string().uuid().optional(),
  topicId: z.string().uuid().optional().nullable(),
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  url: z
    .string()
    .min(1, "URL is required")
    .max(2048, "URL is too long")
    .refine((v) => /^https?:\/\/[^\s]+$/.test(v), "Enter a valid URL starting with http(s)://"),
  resourceType: resourceTypeSchema,
  description: optionalString,
  difficulty: topicDifficultySchema.nullable(),
  isFree: z.boolean(),
  displayOrder: nonNegInt,
});
export type SaveResourceValues = z.infer<typeof saveResourceSchema>;

export const deleteResourceSchema = z.object({ id: z.string().uuid() });
export type DeleteResourceValues = z.infer<typeof deleteResourceSchema>;

// ────────────────────────────── Topic progress (self) ──────────────────────────────
export const topicIdSchema = z.string().uuid();
