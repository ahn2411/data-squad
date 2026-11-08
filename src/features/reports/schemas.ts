import { z } from "zod";

/**
 * Weekly report — a member's reflection for a given week.
 *
 * jsonb string-array columns (topics_completed, exercises_completed,
 * assignments_completed, github_links) are typed `string[]` per
 * @/types/database. The form surfaces each as a newline-separated textarea and
 * converts between text and string[] on submit / prefill.
 *
 * hours_spent is `numeric(5,1)` in the DB; the schema caps it at 0–168 (hours
 * in a week) and the action rounds to one decimal before persisting.
 */
export const weeklyReportSchema = z.object({
  learned: z
    .string()
    .max(8000, "Summary is too long")
    .optional()
    .or(z.literal("")),
  topics_completed: z
    .array(z.string().max(500).trim())
    .max(50, "Too many entries"),
  exercises_completed: z
    .array(z.string().max(500).trim())
    .max(50, "Too many entries"),
  assignments_completed: z
    .array(z.string().max(500).trim())
    .max(50, "Too many entries"),
  hours_spent: z
    .number()
    .min(0, "Hours cannot be negative")
    .max(168, "Hours cannot exceed 168 in a week"),
  biggest_achievement: z
    .string()
    .max(4000, "Entry is too long")
    .optional()
    .or(z.literal("")),
  main_difficulty: z
    .string()
    .max(4000, "Entry is too long")
    .optional()
    .or(z.literal("")),
  current_blockers: z
    .string()
    .max(4000, "Entry is too long")
    .optional()
    .or(z.literal("")),
  questions: z
    .string()
    .max(4000, "Entry is too long")
    .optional()
    .or(z.literal("")),
  next_week_goals: z
    .string()
    .max(4000, "Entry is too long")
    .optional()
    .or(z.literal("")),
  github_links: z
    .array(
      z
        .string()
        .max(2048, "URL is too long")
        .trim()
        .refine(
          (v) => v === "" || /^https?:\/\/[^\s]+$/.test(v),
          "Each link must start with http:// or https://",
        ),
    )
    .max(50, "Too many links"),
});

export type WeeklyReportValues = z.infer<typeof weeklyReportSchema>;

/**
 * Leader feedback — a text-only update appended by leaders/admins to a
 * member's report. The action enforces that ONLY leader_feedback is mutated,
 * never the member's own content.
 */
export const leaderFeedbackSchema = z.object({
  feedback: z
    .string()
    .min(1, "Feedback cannot be empty")
    .max(8000, "Feedback is too long (max 8000 characters)"),
});

export type LeaderFeedbackValues = z.infer<typeof leaderFeedbackSchema>;

/** Generic id-payload schemas used by the actions. */
export const weekIdSchema = z.object({
  weekId: z.string().uuid(),
});

export const reportIdSchema = z.object({
  reportId: z.string().uuid(),
});
