import { z } from "zod";
import type { PublicationStatus } from "@/types/database";

export const PUBLICATION_STATUSES: PublicationStatus[] = [
  "draft",
  "published",
  "archived",
];

/**
 * Schema for creating an announcement.
 * - `status` controls whether it's a draft or published.
 * - When status='published' for the first time, the DB trigger fires
 *   notify_on_announcement which inserts notifications for all active team
 *   members. We NEVER insert notifications from the action.
 */
export const createAnnouncementSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(160, "Title is too long (max 160)"),
  content: z.string().max(8000).optional().or(z.literal("")),
  pinned: z.boolean().default(false),
  status: z
    .enum(PUBLICATION_STATUSES as [PublicationStatus, ...PublicationStatus[]])
    .default("draft"),
});

export type CreateAnnouncementValues = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = z.object({
  id: z.string().uuid(),
  title: z
    .string()
    .min(1, "Title is required")
    .max(160, "Title is too long (max 160)"),
  content: z.string().max(8000).optional().or(z.literal("")),
  pinned: z.boolean().default(false),
  status: z
    .enum(PUBLICATION_STATUSES as [PublicationStatus, ...PublicationStatus[]])
    .default("draft"),
});

export type UpdateAnnouncementValues = z.infer<typeof updateAnnouncementSchema>;

export const announcementIdSchema = z.object({
  announcementId: z.string().uuid(),
});

export type AnnouncementIdValues = z.infer<typeof announcementIdSchema>;

/** Admin-side filter for the announcement list. */
export const adminAnnouncementFilterSchema = z.object({
  status: z
    .enum(["all", "draft", "published", "archived"])
    .default("all"),
  search: z.string().trim().max(120).default(""),
});

export type AdminAnnouncementFilterValues = z.infer<
  typeof adminAnnouncementFilterSchema
>;
