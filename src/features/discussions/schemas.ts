import { z } from "zod";

/**
 * Discussion category set. Stored as plain text on the thread row so the
 * schema isn't locked to an enum — but the form select restricts to these
 * values to keep navigation / filtering consistent.
 */
export const DISCUSSION_CATEGORIES = [
  "General",
  "Python",
  "Mathematics & Statistics",
  "NumPy & Pandas",
  "SQL",
  "Data Visualization",
  "Machine Learning",
  "Projects",
  "Resources",
  "Questions",
] as const;

export type DiscussionCategory = (typeof DISCUSSION_CATEGORIES)[number];

export const createThreadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(160, "Title is too long (max 160 characters)"),
  category: z.enum(DISCUSSION_CATEGORIES),
});

export type CreateThreadValues = z.infer<typeof createThreadSchema>;

export const createPostSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Reply cannot be empty")
    .max(8000, "Reply is too long (max 8000 characters)"),
  parentPostId: z.string().uuid().nullable().optional(),
});

export type CreatePostValues = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Body cannot be empty")
    .max(8000, "Body is too long (max 8000 characters)"),
});

export type UpdatePostValues = z.infer<typeof updatePostSchema>;

export const threadIdSchema = z.object({
  threadId: z.string().uuid(),
});

export const postIdSchema = z.object({
  postId: z.string().uuid(),
});
