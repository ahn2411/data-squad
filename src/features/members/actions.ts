"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import {
  changeRoleSchema,
  inviteSchema,
  memberActionSchema,
  type ChangeRoleValues,
  type InviteValues,
  type MemberActionValues,
} from "./schemas";

export type MemberActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAdmin(): Promise<
  { ok: true; teamId: string; adminId: string } | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const ctx = await getSessionContext();
  if (ctx.status !== "active" || ctx.membership.role !== "admin") {
    return { ok: false, error: "Only admins can perform this action." };
  }
  return { ok: true, teamId: ctx.membership.team_id, adminId: ctx.userId };
}

/** Approve a pending member → active. */
export async function approveMemberAction(
  values: MemberActionValues,
): Promise<MemberActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = memberActionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid member id." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      membership_status: "active",
      joined_at: new Date().toISOString(),
      suspended_at: null,
      removed_at: null,
    })
    .eq("id", parsed.data.memberId)
    .eq("team_id", admin.teamId);

  if (error) return { ok: false, error: "Could not approve the member." };
  revalidatePath("/admin/members");
  return { ok: true };
}

/** Suspend an active member. */
export async function suspendMemberAction(
  values: MemberActionValues,
): Promise<MemberActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = memberActionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid member id." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      membership_status: "suspended",
      suspended_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.memberId)
    .eq("team_id", admin.teamId)
    .neq("user_id", admin.adminId); // never suspend yourself

  if (error) return { ok: false, error: "Could not suspend the member." };
  revalidatePath("/admin/members");
  return { ok: true };
}

/** Reinstate a suspended member. */
export async function reinstateMemberAction(
  values: MemberActionValues,
): Promise<MemberActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = memberActionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid member id." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      membership_status: "active",
      suspended_at: null,
      removed_at: null,
    })
    .eq("id", parsed.data.memberId)
    .eq("team_id", admin.teamId);

  if (error) return { ok: false, error: "Could not reinstate the member." };
  revalidatePath("/admin/members");
  return { ok: true };
}

/** Remove a member from the team (soft delete — preserves audit trail). */
export async function removeMemberAction(
  values: MemberActionValues,
): Promise<MemberActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = memberActionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid member id." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      membership_status: "removed",
      removed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.memberId)
    .eq("team_id", admin.teamId)
    .neq("user_id", admin.adminId); // never remove yourself

  if (error) return { ok: false, error: "Could not remove the member." };
  revalidatePath("/admin/members");
  return { ok: true };
}

/** Change a member's role. */
export async function changeRoleAction(
  values: ChangeRoleValues,
): Promise<MemberActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = changeRoleSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("team_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.memberId)
    .eq("team_id", admin.teamId)
    .neq("user_id", admin.adminId); // never change your own role (FR-SEC.4)

  if (error) return { ok: false, error: "Could not change the role." };
  revalidatePath("/admin/members");
  return { ok: true };
}

/** Create an invitation for a new member. */
export async function inviteMemberAction(
  values: InviteValues,
): Promise<MemberActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("invitations").insert({
    team_id: admin.teamId,
    email: parsed.data.email,
    role: parsed.data.role,
    invited_by: admin.adminId,
    status: "sent",
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), // 7d
  });

  if (error) {
    return { ok: false, error: "Could not create the invitation." };
  }
  revalidatePath("/admin/members");
  return { ok: true };
}
