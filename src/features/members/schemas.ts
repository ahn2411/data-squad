import { z } from "zod";

export const changeRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["admin", "leader", "member"]),
});

export type ChangeRoleValues = z.infer<typeof changeRoleSchema>;

export const inviteSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  role: z.enum(["admin", "leader", "member"]).default("member"),
});

export type InviteValues = z.infer<typeof inviteSchema>;

export const memberActionSchema = z.object({
  memberId: z.string().uuid(),
});

export type MemberActionValues = z.infer<typeof memberActionSchema>;
