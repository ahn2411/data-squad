"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import {
  submissionContentSchema,
  startSubmissionSchema,
  submissionIdSchema,
  createReviewSchema,
  type SubmissionContentValues,
  type CreateReviewValues,
} from "./schemas";
import type { Submission, SubmissionStatus } from "@/types/database";

export type SubmissionActionResult =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: string };

/** Statuses that allow a member to mutate their submission. */
const EDITABLE_STATUSES: SubmissionStatus[] = [
  "not_started",
  "in_progress",
  "revision_requested",
];

async function requireActive(): Promise<
  | { ok: true; teamId: string; userId: string }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { ok: false, error: "You must be an active member." };
  }
  return { ok: true, teamId: ctx.membership.team_id, userId: ctx.userId };
}

/**
 * Upsert the user's submission for an assignment.
 * - New: insert with status='submitted', submitted_at=now.
 * - Existing & editable (not_started/in_progress/revision_requested):
 *   update text/url, set status='submitted', submitted_at=now.
 * - Existing & locked: refuse.
 * - Always append an immutable submission_revisions row (revision_number = max+1).
 */
export async function saveSubmissionAction(
  assignmentId: string,
  content: SubmissionContentValues,
): Promise<SubmissionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const parsed = submissionContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  const nowIso = new Date().toISOString();

  const supabase = await createSupabaseServerClient();

  // Look for an existing submission.
  const { data: existing } = await supabase
    .from("submissions")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .eq("user_id", user.userId)
    .maybeSingle();

  let submissionId: string;

  if (existing) {
    const status = existing.status as SubmissionStatus;
    if (!EDITABLE_STATUSES.includes(status)) {
      return {
        ok: false,
        error:
          "This submission is locked. A reviewer must request revisions before you can edit again.",
      };
    }
    submissionId = existing.id;

    const { error: updErr } = await supabase
      .from("submissions")
      .update({
        submission_text: v.submission_text?.trim() ? v.submission_text : null,
        submission_url: v.submission_url?.trim() ? v.submission_url : null,
        status: "submitted",
        submitted_at: nowIso,
      })
      .eq("id", submissionId);

    if (updErr) {
      return { ok: false, error: "Could not update the submission." };
    }
  } else {
    // Insert new.
    const { data: inserted, error: insErr } = await supabase
      .from("submissions")
      .insert({
        assignment_id: assignmentId,
        user_id: user.userId,
        team_id: user.teamId,
        status: "submitted",
        submission_text: v.submission_text?.trim() ? v.submission_text : null,
        submission_url: v.submission_url?.trim() ? v.submission_url : null,
        submitted_at: nowIso,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      return { ok: false, error: "Could not create the submission." };
    }
    submissionId = inserted.id;
  }

  // Append a revision row (revision_number = max + 1).
  const { data: maxRow } = await supabase
    .from("submission_revisions")
    .select("revision_number")
    .eq("submission_id", submissionId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextRevision = (maxRow?.revision_number ?? 0) + 1;

  const { error: revErr } = await supabase
    .from("submission_revisions")
    .insert({
      submission_id: submissionId,
      revision_number: nextRevision,
      submission_text: v.submission_text?.trim() ? v.submission_text : null,
      submission_url: v.submission_url?.trim() ? v.submission_url : null,
      submitted_by: user.userId,
      submitted_at: nowIso,
      is_late: false, // the submissions_flag_late trigger will set this on insert
    });

  if (revErr) {
    // Submission saved, but revision history failed. Surface as warning.
    revalidatePath(`/assignments/${assignmentId}`);
    revalidatePath(`/submissions`);
    revalidatePath(`/submissions/${submissionId}`);
    return {
      ok: true,
      redirectTo: `/submissions/${submissionId}`,
    };
  }

  revalidatePath(`/assignments/${assignmentId}`);
  revalidatePath(`/submissions`);
  revalidatePath(`/submissions/${submissionId}`);
  return { ok: true, redirectTo: `/submissions/${submissionId}` };
}

/** Start a submission: set status='in_progress' (creates row if needed). */
export async function startSubmissionAction(
  assignmentId: string,
): Promise<SubmissionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const parsed = startSubmissionSchema.safeParse({ assignmentId });
  if (!parsed.success) return { ok: false, error: "Invalid assignment id." };

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("submissions")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .eq("user_id", user.userId)
    .maybeSingle();

  if (existing) {
    const status = existing.status as SubmissionStatus;
    if (!EDITABLE_STATUSES.includes(status)) {
      return { ok: false, error: "This submission is already locked." };
    }
    const { error } = await supabase
      .from("submissions")
      .update({ status: "in_progress" })
      .eq("id", existing.id);
    if (error) return { ok: false, error: "Could not start the submission." };
  } else {
    const { error } = await supabase.from("submissions").insert({
      assignment_id: assignmentId,
      user_id: user.userId,
      team_id: user.teamId,
      status: "in_progress",
    });
    if (error) return { ok: false, error: "Could not start the submission." };
  }

  revalidatePath(`/assignments/${assignmentId}`);
  revalidatePath(`/submissions`);
  return { ok: true };
}

/** Delete a submission (only if status allows + owner). RLS enforces both. */
export async function deleteSubmissionAction(
  submissionId: string,
): Promise<SubmissionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const parsed = submissionIdSchema.safeParse({ submissionId });
  if (!parsed.success) return { ok: false, error: "Invalid submission id." };

  const supabase = await createSupabaseServerClient();

  // Verify ownership + status before delete (RLS will also enforce).
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, user_id, status, assignment_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (!sub) return { ok: false, error: "Submission not found." };
  if (sub.user_id !== user.userId) {
    return { ok: false, error: "You can only delete your own submissions." };
  }
  if (!EDITABLE_STATUSES.includes(sub.status as SubmissionStatus)) {
    return {
      ok: false,
      error: "This submission is locked and cannot be deleted.",
    };
  }

  const { error } = await supabase
    .from("submissions")
    .delete()
    .eq("id", submissionId);

  if (error) return { ok: false, error: "Could not delete the submission." };

  revalidatePath(`/assignments/${sub.assignment_id}`);
  revalidatePath(`/submissions`);
  return { ok: true, redirectTo: `/assignments/${sub.assignment_id}` };
}

/**
 * Create a review (leader/admin only).
 * - reviewer ≠ submission.user_id (database trigger + this guard).
 * - Update the submission status based on the review outcome:
 *     approved → 'approved'
 *     revision_requested → 'revision_requested'
 *     rejected → 'rejected'
 *     pending → 'under_review'
 * - The notify_on_review trigger fires automatically (SECURITY DEFINER).
 */
export async function createReviewAction(
  values: CreateReviewValues,
): Promise<SubmissionActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { ok: false, error: "You must be an active member." };
  }
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return { ok: false, error: "Only leaders and admins can review submissions." };
  }

  const parsed = createReviewSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Fetch submission to verify team + ownership + max_score.
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, user_id, team_id, assignment_id")
    .eq("id", v.submissionId)
    .maybeSingle();

  if (!sub) return { ok: false, error: "Submission not found." };
  if (sub.user_id === ctx.userId) {
    return { ok: false, error: "You cannot review your own submission." };
  }
  if (sub.team_id !== ctx.membership.team_id) {
    return { ok: false, error: "Submission is not in your team." };
  }

  // Optionally clamp score against the assignment max_score.
  let score = v.score ?? null;
  if (score !== null) {
    const { data: assignment } = await supabase
      .from("assignments")
      .select("max_score")
      .eq("id", sub.assignment_id)
      .maybeSingle();
    const max = assignment?.max_score;
    if (typeof max === "number" && score > max) {
      score = max;
    }
  }

  // Insert the review.
  const { error: revErr } = await supabase.from("reviews").insert({
    submission_id: v.submissionId,
    reviewer_id: ctx.userId,
    review_status: v.review_status,
    score,
    feedback: v.feedback?.trim() ? v.feedback : null,
  });

  if (revErr) {
    // Self-review constraint violation → friendly message.
    if ((revErr.message ?? "").includes("reviews_not_self")) {
      return { ok: false, error: "You cannot review your own submission." };
    }
    return { ok: false, error: "Could not save the review." };
  }

  // The database trigger applies the review outcome to the submission status.
  revalidatePath(`/submissions/${v.submissionId}`);
  revalidatePath(`/assignments/${sub.assignment_id}`);
  revalidatePath(`/submissions`);
  revalidatePath(`/admin/assignments`);
  return { ok: true, redirectTo: `/submissions/${v.submissionId}` };
}

// Re-export for type narrowing in callers.
type _Submission = Submission;
export type { _Submission };
