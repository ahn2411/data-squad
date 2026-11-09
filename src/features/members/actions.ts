"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthCallbackUrl } from "@/lib/auth-redirect";
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
  const { data: updated, error } = await supabase
    .from("team_members")
    .update({
      membership_status: "active",
      joined_at: new Date().toISOString(),
      suspended_at: null,
      removed_at: null,
    })
    .eq("id", parsed.data.memberId)
    .eq("team_id", admin.teamId)
    .in("membership_status", ["pending_invite", "pending_approval"])
    .select("id")
    .maybeSingle();

  if (error || !updated) return { ok: false, error: "Could not approve the member. Their membership may have changed; refresh and try again." };
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
  const { data: updated, error } = await supabase
    .from("team_members")
    .update({
      membership_status: "suspended",
      suspended_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.memberId)
    .eq("team_id", admin.teamId)
    .eq("membership_status", "active")
    .neq("user_id", admin.adminId) // never suspend yourself
    .select("id")
    .maybeSingle();

  if (error || !updated) return { ok: false, error: "Could not suspend the member. Their membership may have changed; refresh and try again." };
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
  const { data: updated, error } = await supabase
    .from("team_members")
    .update({
      membership_status: "active",
      suspended_at: null,
      removed_at: null,
    })
    .eq("id", parsed.data.memberId)
    .eq("team_id", admin.teamId)
    .in("membership_status", ["suspended", "removed"])
    .select("id")
    .maybeSingle();

  if (error || !updated) return { ok: false, error: "Could not reinstate the member. Their membership may have changed; refresh and try again." };
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
  const { data: updated, error } = await supabase
    .from("team_members")
    .update({
      membership_status: "removed",
      removed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.memberId)
    .eq("team_id", admin.teamId)
    .in("membership_status", ["active", "suspended"])
    .neq("user_id", admin.adminId) // never remove yourself
    .select("id")
    .maybeSingle();

  if (error || !updated) return { ok: false, error: "Could not remove the member. Their membership may have changed; refresh and try again." };
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
  const { data: updated, error } = await supabase
    .from("team_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.memberId)
    .eq("team_id", admin.teamId)
    .neq("user_id", admin.adminId) // never change your own role (FR-SEC.4)
    .select("id")
    .maybeSingle();

  if (error || !updated) return { ok: false, error: "Could not change the role. Refresh and try again." };
  revalidatePath("/admin/members");
  return { ok: true };
}

/** Send an expiring Supabase Auth invitation to a new member. */
export async function inviteMemberAction(
  values: InviteValues,
): Promise<MemberActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const ctx = await getSessionContext();
  if (
    ctx.status !== "active" ||
    (ctx.membership.role !== "admin" && ctx.membership.role !== "leader")
  ) {
    return { ok: false, error: "Only team leaders and admins can invite members." };
  }
  const inviter = {
    teamId: ctx.membership.team_id,
    userId: ctx.userId,
    role: ctx.membership.role,
  };

  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  if (parsed.data.role === "admin" || (inviter.role === "leader" && parsed.data.role !== "member")) {
    return { ok: false, error: "You cannot invite someone with that role." };
  }

  const redirectTo = getAuthCallbackUrl("/pending-approval");
  if (!redirectTo) {
    return { ok: false, error: "Invitation emails are not configured for this deployment." };
  }

  let adminAuth;
  try {
    adminAuth = createSupabaseAdminClient();
  } catch {
    return {
      ok: false,
      error: "Invitations need the server-only SUPABASE_SERVICE_ROLE_KEY configured.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: invitation, error: invitationError } = await supabase
    .from("invitations")
    .insert({
      team_id: inviter.teamId,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: inviter.userId,
      status: "sent",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    })
    .select("id")
    .single();

  if (invitationError || !invitation) {
    return { ok: false, error: "Could not create the invitation." };
  }

  const { error: authError } = await adminAuth.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      redirectTo,
    },
  );

  if (authError) {
    await supabase.from("invitations").delete().eq("id", invitation.id);
    if (authError.code === "over_email_send_rate_limit") {
      return {
        ok: false,
        error: "Supabase reached its auth email limit. Wait before retrying or configure custom SMTP.",
      };
    }
    if (authError.message.toLowerCase().includes("already registered")) {
      return {
        ok: false,
        error: "An account already exists for this email. Ask them to sign in or request access instead.",
      };
    }
    return { ok: false, error: "Could not send the invitation email." };
  }

  revalidatePath("/admin/members");
  return { ok: true };
}
