import { z } from "zod";

/**
 * Editable profile fields per the permission matrix. Role, email, and
 * membership status are deliberately excluded — those are admin-managed.
 */
export const profileSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(80, "Full name is too long"),
  username: z
    .string()
    .max(40, "Username is too long")
    .regex(/^[a-zA-Z0-9_-]*$/, "Use letters, numbers, underscores, or hyphens")
    .optional()
    .or(z.literal("")),
  bio: z
    .string()
    .max(280, "Bio is too long (max 280 characters)")
    .optional()
    .or(z.literal("")),
  githubUsername: z
    .string()
    .max(39, "GitHub username is too long")
    .regex(/^[a-zA-Z0-9-]*$/, "Use letters, numbers, or hyphens")
    .optional()
    .or(z.literal("")),
  githubProfileUrl: z
    .string()
    .max(255, "URL is too long")
    .refine(
      (v) => v === "" || /^https:\/\/github\.com\/[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/?$/.test(v),
      "Enter a GitHub profile URL like https://github.com/username",
    )
    .optional()
    .or(z.literal("")),
  capstoneRepositoryUrl: z
    .string()
    .max(255, "Repository URL is too long")
    .refine(
      (v) => v === "" || /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*\/?$/.test(v),
      "Enter a GitHub repository URL like https://github.com/owner/repository",
    )
    .optional()
    .or(z.literal("")),
  avatarPath: z.string().max(300).optional().or(z.literal("")),
  timezone: z.string().min(1, "Timezone is required").max(50),
});

export type ProfileValues = z.infer<typeof profileSchema>;
