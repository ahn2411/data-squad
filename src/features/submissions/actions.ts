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
  submissionFileSchema,
  type SubmissionContentValues,
  type CreateReviewValues,
  type SubmissionFileValues,
} from "./schemas";
import type { Submission, SubmissionStatus, SubmissionType } from "@/types/database";

export type SubmissionActionResult =
  | { ok: true; redirectTo?: string; submissionId?: string }
  | { ok: false; error: string };

/** Statuses that allow a member to mutate their submission. */
const EDITABLE_STATUSES: SubmissionStatus[] = [
  "not_started",
  "in_progress",
  "revision_requested",
];

const URL_SUBMISSION_TYPES = new Set<SubmissionType>([
  "github_repo",
  "github_pr",
  "github_commit",
  "external_url",
]);

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

  const parsedId = submissionIdSchema.shape.submissionId.safeParse(assignmentId);
  if (!parsedId.success) return { ok: false, error: "Invalid assignment id." };

  const parsed = submissionContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  const nowIso = new Date().toISOString();

  const supabase = await createSupabaseServerClient();

  const { data: assignment, error: assignmentErr } = await supabase
    .from("assignments")
    .select("required_submission_type")
    .eq("id", assignmentId)
    .maybeSingle();

  if (assignmentErr || !assignment) {
    return { ok: false, error: "Could not verify this assignment. Refresh and try again." };
  }

  const requiredType = assignment.required_submission_type ?? "external_url";
  if (v.submission_type !== requiredType) {
    return { ok: false, error: "The required submission type changed. Refresh the assignment and try again." };
  }

  // Look for an existing submission.
  const { data: existing, error: existingErr } = await supabase
    .from("submissions")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .eq("user_id", user.userId)
    .maybeSingle();

  if (existingErr) {
    return { ok: false, error: "Could not check your existing submission." };
  }

  if (URL_SUBMISSION_TYPES.has(requiredType) && !v.submission_url?.trim()) {
    return { ok: false, error: "Add the URL required for this assignment." };
  }
  if (requiredType === "written" && !v.submission_text?.trim()) {
    return { ok: false, error: "Add the written response required for this assignment." };
  }
  if (requiredType === "document" || requiredType === "image" || requiredType === "file") {
    if (!existing) {
      return { ok: false, error: "Attach the file required for this assignment." };
    }
    const { count, error } = await supabase
      .from("submission_files")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", existing.id);
    if (error || !count) {
      return { ok: false, error: "Attach the file required for this assignment." };
    }
  }

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

    const { data: updated, error: updErr } = await supabase
      .from("submissions")
      .update({
        submission_text: v.submission_text?.trim() ? v.submission_text : null,
        submission_url: v.submission_url?.trim() ? v.submission_url : null,
        status: "submitted",
        submitted_at: nowIso,
      })
      .eq("id", submissionId)
      .select("id")
      .maybeSingle();

    if (updErr || !updated) {
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
  const { data: maxRow, error: revisionReadErr } = await supabase
    .from("submission_revisions")
    .select("revision_number")
    .eq("submission_id", submissionId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (revisionReadErr) {
    revalidatePath(`/assignments/${assignmentId}`);
    revalidatePath(`/submissions`);
    revalidatePath(`/submissions/${submissionId}`);
    return {
      ok: false,
      error: "Your submission was saved, but its revision history could not be checked. Please contact a team leader before submitting again.",
    };
  }

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
    revalidatePath(`/assignments/${assignmentId}`);
    revalidatePath(`/submissions`);
    revalidatePath(`/submissions/${submissionId}`);
    return {
      ok: false,
      error: "Your submission was saved, but its revision history could not be recorded. Please contact a team leader before submitting again.",
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

  const parsedId = submissionIdSchema.shape.submissionId.safeParse(assignmentId);
  if (!parsedId.success) return { ok: false, error: "Invalid assignment id." };

  const parsed = startSubmissionSchema.safeParse({ assignmentId });
  if (!parsed.success) return { ok: false, error: "Invalid assignment id." };

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingErr } = await supabase
    .from("submissions")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .eq("user_id", user.userId)
    .maybeSingle();

  if (existingErr) {
    return { ok: false, error: "Could not check your existing submission." };
  }

  let submissionId: string;
  if (existing) {
    const status = existing.status as SubmissionStatus;
    if (!EDITABLE_STATUSES.includes(status)) {
      return { ok: false, error: "This submission is already locked." };
    }
    const { data: updated, error } = await supabase
      .from("submissions")
      .update({ status: "in_progress" })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      return { ok: false, error: "Could not start the submission. Its status may have changed; refresh and try again." };
    }
    submissionId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("submissions")
      .insert({
        assignment_id: assignmentId,
        user_id: user.userId,
        team_id: user.teamId,
        status: "in_progress",
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "Could not start the submission." };
    submissionId = data.id;
  }

  revalidatePath(`/assignments/${assignmentId}`);
  revalidatePath(`/submissions`);
  return { ok: true, submissionId };
}

/** Register an uploaded object as a submission attachment after verifying it exists. */
export async function registerSubmissionFileAction(
  values: SubmissionFileValues,
): Promise<SubmissionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;
  const parsed = submissionFileSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid file." };
  }
  const file = parsed.data;
  const prefix = `${user.teamId}/${user.userId}/${file.submissionId}/`;
  const fileName = file.storagePath.slice(prefix.length);
  if (!file.storagePath.startsWith(prefix) || fileName.includes("/") || !fileName) {
    return { ok: false, error: "The uploaded file path is invalid." };
  }

  const supabase = await createSupabaseServerClient();
  const discardObject = async () => {
    await supabase.storage.from("squad-attachments").remove([file.storagePath]);
  };
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, assignment_id, status")
    .eq("id", file.submissionId)
    .eq("user_id", user.userId)
    .maybeSingle();
  if (!submission) {
    await discardObject();
    return { ok: false, error: "Submission not found." };
  }
  if (!EDITABLE_STATUSES.includes(submission.status as SubmissionStatus)) {
    await discardObject();
    return { ok: false, error: "This submission is locked." };
  }

  const folder = `${user.teamId}/${user.userId}/${file.submissionId}`;
  const { data: objects, error: listError } = await supabase.storage
    .from("squad-attachments")
    .list(folder, { search: fileName });
  const object = objects?.find((entry) => entry.name === fileName);
  if (listError || !object) {
    await discardObject();
    return { ok: false, error: "The uploaded file could not be verified." };
  }
  const metadata = object.metadata as Record<string, unknown> | null;
  if (
    typeof metadata?.size !== "number" ||
    typeof metadata?.mimetype !== "string" ||
    metadata.size !== file.fileSize ||
    metadata.mimetype !== file.contentType
  ) {
    await discardObject();
    return { ok: false, error: "The uploaded file details did not match." };
  }

  const { count, error: countError } = await supabase
    .from("submission_files")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", file.submissionId);
  if (countError) {
    await discardObject();
    return { ok: false, error: "Could not verify existing attachments." };
  }
  if ((count ?? 0) >= 10) {
    await discardObject();
    return { ok: false, error: "A submission can contain at most 10 files." };
  }

  const { error: insertError } = await supabase.from("submission_files").insert({
    submission_id: file.submissionId,
    storage_path: file.storagePath,
    file_name: file.fileName,
    content_type: file.contentType,
    file_size: file.fileSize,
    uploaded_by: user.userId,
  });
  if (insertError) {
    await supabase.storage.from("squad-attachments").remove([file.storagePath]);
    return { ok: false, error: "Could not attach the uploaded file." };
  }

  revalidatePath(`/assignments/${submission.assignment_id}`);
  revalidatePath(`/submissions/${submission.id}`);
  return { ok: true, submissionId: submission.id };
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
  const { data: sub, error: submissionError } = await supabase
    .from("submissions")
    .select("id, user_id, status, assignment_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) {
    return { ok: false, error: "Could not verify the submission before deleting it." };
  }
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
  const { data: sub, error: submissionError } = await supabase
    .from("submissions")
    .select("id, user_id, team_id, assignment_id, status")
    .eq("id", v.submissionId)
    .maybeSingle();

  if (submissionError) {
    return { ok: false, error: "Could not verify the submission for review." };
  }
  if (!sub) return { ok: false, error: "Submission not found." };
  if (sub.status !== "submitted" && sub.status !== "under_review") {
    return { ok: false, error: "This submission is no longer waiting for review." };
  }
  if (sub.user_id === ctx.userId) {
    return { ok: false, error: "You cannot review your own submission." };
  }
  if (sub.team_id !== ctx.membership.team_id) {
    return { ok: false, error: "Submission is not in your team." };
  }

  // Optionally clamp score against the assignment max_score.
  let score = v.score ?? null;
  if (score !== null) {
    const { data: assignment, error: assignmentError } = await supabase
      .from("assignments")
      .select("max_score")
      .eq("id", sub.assignment_id)
      .maybeSingle();
    if (assignmentError || !assignment) {
      return { ok: false, error: "Could not verify the assignment score limit." };
    }
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
