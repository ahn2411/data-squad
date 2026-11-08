"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import {
  createBlockerSchema,
  updateBlockerStatusSchema,
  updateOwnBlockerSchema,
  createCommentSchema,
  type CreateBlockerValues,
  type UpdateBlockerStatusValues,
  type UpdateOwnBlockerValues,
  type CreateCommentValues,
} from "./schemas";

export type BlockerActionResult =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: string };

async function requireActive(): Promise<
  | { ok: true; teamId: string; userId: string; role: string }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { ok: false, error: "You must be an active member." };
  }
  return {
    ok: true,
    teamId: ctx.membership.team_id,
    userId: ctx.userId,
    role: ctx.membership.role,
  };
}

function nullIfEmpty(v: string | undefined | null): string | null {
  if (!v || v.trim() === "") return null;
  return v;
}

/**
 * Create the current user's own blocker (status='open').
 * RLS: blockers_self_insert requires user_id = auth.uid().
 */
export async function createBlockerAction(
  values: CreateBlockerValues,
): Promise<BlockerActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const parsed = createBlockerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("blockers")
    .insert({
      team_id: user.teamId,
      user_id: user.userId,
      title: v.title,
      description: nullIfEmpty(v.description),
      topic_id: v.topicId ?? null,
      assignment_id: v.assignmentId ?? null,
      error_messages: nullIfEmpty(v.errorMessages),
      code_url: nullIfEmpty(v.codeUrl),
      priority: v.priority,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not create the blocker." };
  }

  revalidatePath("/blockers");
  revalidatePath(`/blockers/${data.id}`);
  revalidatePath("/dashboard");
  return { ok: true, redirectTo: `/blockers/${data.id}` };
}

/**
 * Owner updates their own blocker (editable fields only — title, description,
 * topic/assignment, error messages, code URL, priority). RLS allows
 * user_id = auth.uid() to update; we deliberately do NOT touch status /
 * assigned_helper / resolution_notes here.
 */
export async function updateOwnBlockerAction(
  id: string,
  values: UpdateOwnBlockerValues,
): Promise<BlockerActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const parsed = updateOwnBlockerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Verify ownership first (RLS would allow it, but a leader/admin also has
  // update rights via RLS — we don't want them editing via this action).
  const { data: existing } = await supabase
    .from("blockers")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Blocker not found." };
  if (existing.user_id !== user.userId) {
    return { ok: false, error: "You can only edit your own blockers." };
  }

  const { error } = await supabase
    .from("blockers")
    .update({
      title: v.title,
      description: nullIfEmpty(v.description),
      topic_id: v.topicId ?? null,
      assignment_id: v.assignmentId ?? null,
      error_messages: nullIfEmpty(v.errorMessages),
      code_url: nullIfEmpty(v.codeUrl),
      priority: v.priority,
    })
    .eq("id", id);

  if (error) return { ok: false, error: "Could not save the blocker." };

  revalidatePath("/blockers");
  revalidatePath(`/blockers/${id}`);
  return { ok: true };
}

/**
 * Leader/admin only: update a blocker's status, assign a helper, and add
 * resolution notes. RLS allows owner OR leader/admin to update; we restrict
 * this action to leader/admin, and only the status/helper/resolution fields.
 */
export async function updateBlockerStatusAction(
  id: string,
  values: UpdateBlockerStatusValues,
): Promise<BlockerActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  if (user.role !== "admin" && user.role !== "leader") {
    return {
      ok: false,
      error: "Only leaders and admins can update blocker status.",
    };
  }

  const parsed = updateBlockerStatusSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  const updateRow: {
    status: typeof v.status;
    assigned_helper: string | null;
    resolution_notes: string | null;
  } = {
    status: v.status,
    assigned_helper: v.assignedHelper ?? null,
    resolution_notes: nullIfEmpty(v.resolutionNotes),
  };

  // If a helper is assigned and status is still 'open', nudge it to 'being_addressed'.
  if (updateRow.assigned_helper !== null && updateRow.status === "open") {
    updateRow.status = "being_addressed";
  }

  const { error } = await supabase
    .from("blockers")
    .update(updateRow)
    .eq("id", id);

  if (error) return { ok: false, error: "Could not update the blocker." };

  revalidatePath("/blockers");
  revalidatePath(`/blockers/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Add a comment on a blocker (any active member who can see the blocker).
 * RLS on blocker_comments allows author_id = auth.uid() to insert.
 */
export async function createBlockerCommentAction(
  blockerId: string,
  values: CreateCommentValues,
): Promise<BlockerActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const parsed = createCommentSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("blocker_comments")
    .insert({
      blocker_id: blockerId,
      author_id: user.userId,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not post the comment." };
  }

  revalidatePath(`/blockers/${blockerId}`);
  return { ok: true };
}

/** Delete a comment (own only — RLS enforces author_id = auth.uid()). */
export async function deleteBlockerCommentAction(
  commentId: string,
): Promise<BlockerActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const supabase = await createSupabaseServerClient();

  // Fetch the comment to find its blocker_id (for revalidation) and verify
  // ownership before delete. RLS would also block non-authors, but we surface
  // a clearer error.
  const { data: comment } = await supabase
    .from("blocker_comments")
    .select("id, author_id, blocker_id")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) return { ok: false, error: "Comment not found." };
  if (comment.author_id !== user.userId) {
    return { ok: false, error: "You can only delete your own comments." };
  }

  const { error } = await supabase
    .from("blocker_comments")
    .delete()
    .eq("id", commentId);

  if (error) return { ok: false, error: "Could not delete the comment." };

  revalidatePath(`/blockers/${comment.blocker_id}`);
  return { ok: true };
}
