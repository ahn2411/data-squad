import { z } from "zod";
import type { SubmissionType, ReviewStatus } from "@/types/database";

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

export const REVIEW_STATUSES: ReviewStatus[] = [
  "pending",
  "approved",
  "revision_requested",
  "rejected",
];

export const SUBMISSION_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const submissionFileSchema = z.object({
  submissionId: z.string().uuid(),
  storagePath: z.string().max(600),
  fileName: z.string().min(1).max(255),
  contentType: z.enum(SUBMISSION_FILE_TYPES),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});

export type SubmissionFileValues = z.infer<typeof submissionFileSchema>;

/**
 * Submission content. Depending on the assignment's required_submission_type,
 * the member supplies text, a URL, or both (URL is primary for github_repo /
 * github_pr / github_commit / external_url; text is primary for written;
 * image / file require Storage and are gated).
 */
export const submissionContentSchema = z
  .object({
    submission_type: z.enum(SUBMISSION_TYPES as [SubmissionType, ...SubmissionType[]]),
    submission_text: z.string().max(20000).optional().or(z.literal("")),
    submission_url: z
      .string()
      .max(2048)
      .refine(
        (v) => v === "" || /^https?:\/\/[^\s]+$/.test(v),
        "Enter a valid URL starting with http:// or https://",
      )
      .optional()
      .or(z.literal("")),
  });

export type SubmissionContentValues = z.infer<typeof submissionContentSchema>;

/** Save-submission action payload (assignmentId + content). */
export const saveSubmissionSchema = z.object({
  assignmentId: z.string().uuid(),
  content: submissionContentSchema,
});

export type SaveSubmissionValues = z.infer<typeof saveSubmissionSchema>;

export const startSubmissionSchema = z.object({
  assignmentId: z.string().uuid(),
});

export type StartSubmissionValues = z.infer<typeof startSubmissionSchema>;

export const submissionIdSchema = z.object({
  submissionId: z.string().uuid(),
});

export type SubmissionIdValues = z.infer<typeof submissionIdSchema>;

/** Review form: status, optional score (0..max_score), feedback. */
export const createReviewSchema = z
  .object({
    submissionId: z.string().uuid(),
    review_status: z.enum(REVIEW_STATUSES as [ReviewStatus, ...ReviewStatus[]]),
    score: z
      .number()
      .int("Score must be an integer")
      .min(0, "Score cannot be negative")
      .max(1000, "Score is too large")
      .nullable()
      .optional(),
    feedback: z.string().max(8000).optional().or(z.literal("")),
  })
  .refine(
    (v) =>
      v.review_status !== "approved" ||
      v.score === null ||
      v.score === undefined ||
      v.score >= 0,
    { message: "Invalid score." },
  );

export type CreateReviewValues = z.infer<typeof createReviewSchema>;
