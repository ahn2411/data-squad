"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  publishAssignmentSchema,
  assignmentIdSchema,
  type CreateAssignmentValues,
  type UpdateAssignmentValues,
  type PublishAssignmentValues,
} from "./schemas";
import type { Assignment } from "@/types/database";
import type {
  AssignmentInsert,
  AssignmentUpdate,
} from "@/features/submissions/types";

export type AssignmentActionResult =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: string };

async function requireLeader(): Promise<
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
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return { ok: false, error: "Only leaders and admins can manage assignments." };
  }
  return { ok: true, teamId: ctx.membership.team_id, userId: ctx.userId };
}

/** Normalise empty strings to null for nullable DB columns. */
function nullIfEmpty(v: string | undefined | null): string | null {
  if (!v || v.trim() === "") return null;
  return v;
}

/** Replace recipients for an assignment: delete existing, then insert. */
async function replaceRecipients(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  assignmentId: string,
  recipientUserIds: string[],
  teamId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (recipientUserIds.length === 0) {
    const { error: delErr } = await supabase
      .from("assignment_recipients")
      .delete()
      .eq("assignment_id", assignmentId);
    if (delErr) return { ok: false, error: "Could not clear recipients." };
    return { ok: true };
  }

  // Validate recipients are active team members.
  const { data: members, error: mErr } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("membership_status", "active")
    .in("user_id", recipientUserIds);

  if (mErr) return { ok: false, error: "Could not validate recipients." };

  const validIds = new Set((members ?? []).map((m) => m.user_id));
  const invalid = recipientUserIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    return { ok: false, error: "Some recipients are not active team members." };
  }

  // Delete existing, then insert (RLS allows leader/admin).
  const { error: delErr } = await supabase
    .from("assignment_recipients")
    .delete()
    .eq("assignment_id", assignmentId);
  if (delErr) return { ok: false, error: "Could not replace recipients." };

  const inserts = recipientUserIds.map((uid) => ({
    assignment_id: assignmentId,
    user_id: uid,
  }));
  const { error: insErr } = await supabase
    .from("assignment_recipients")
    .insert(inserts);
  if (insErr) return { ok: false, error: "Could not save recipients." };
  return { ok: true };
}

/** Create an assignment (admin/leader). */
export async function createAssignmentAction(
  values: CreateAssignmentValues,
): Promise<AssignmentActionResult> {
  const leader = await requireLeader();
  if (!leader.ok) return leader;

  const parsed = createAssignmentSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  const insertRow: AssignmentInsert = {
    team_id: leader.teamId,
    title: v.title,
    description: nullIfEmpty(v.description),
    instructions: nullIfEmpty(v.instructions),
    phase_id: v.phase_id ?? null,
    week_id: v.week_id ?? null,
    topic_id: v.topic_id ?? null,
    assignment_type: v.assignment_type,
    difficulty: v.difficulty,
    max_score: v.max_score ?? null,
    required_submission_type: v.required_submission_type ?? null,
    supporting_resources: v.supporting_resources,
    deliverables: v.deliverables,
    evaluation_criteria: v.evaluation_criteria,
    publication_status: v.publication_status,
    published_at:
      v.publication_status === "published" ? new Date().toISOString() : null,
    deadline: nullIfEmpty(v.deadline),
    created_by: leader.userId,
    display_order: 0,
  };

  const { data, error } = await supabase
    .from("assignments")
    .insert(insertRow)
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: mapAssignmentError(error, "Could not create the assignment."),
    };
  }

  // Save recipients (if any). If creating as published, recipients are needed
  // so RLS lets the targeted members see the row.
  if (v.recipientUserIds.length > 0) {
    const recRes = await replaceRecipients(
      supabase,
      data.id,
      v.recipientUserIds,
      leader.teamId,
    );
    if (!recRes.ok) {
      // Best-effort: the assignment exists; surface the recipient error.
      revalidatePath("/admin/assignments");
      revalidatePath("/assignments");
      return { ok: false, error: recRes.error };
    }
  }

  revalidatePath("/admin/assignments");
  revalidatePath("/assignments");
  return { ok: true, redirectTo: `/admin/assignments/${data.id}/edit` };
}

/** Update an existing assignment (admin/leader). */
export async function updateAssignmentAction(
  values: UpdateAssignmentValues,
): Promise<AssignmentActionResult> {
  const leader = await requireLeader();
  if (!leader.ok) return leader;

  const parsed = updateAssignmentSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Fetch current row to detect publication transition.
  const { data: current } = await supabase
    .from("assignments")
    .select("publication_status, published_at")
    .eq("id", v.id)
    .maybeSingle();

  if (!current) {
    return { ok: false, error: "Assignment not found." };
  }

  const wasPublished = current.publication_status === "published";
  const nowPublished = v.publication_status === "published";

  const updateRow: AssignmentUpdate = {
    title: v.title,
    description: nullIfEmpty(v.description),
    instructions: nullIfEmpty(v.instructions),
    phase_id: v.phase_id ?? null,
    week_id: v.week_id ?? null,
    topic_id: v.topic_id ?? null,
    assignment_type: v.assignment_type,
    difficulty: v.difficulty,
    max_score: v.max_score ?? null,
    required_submission_type: v.required_submission_type ?? null,
    supporting_resources: v.supporting_resources,
    deliverables: v.deliverables,
    evaluation_criteria: v.evaluation_criteria,
    publication_status: v.publication_status,
    published_at: nowPublished
      ? wasPublished
        ? current.published_at // preserve first-published timestamp
        : new Date().toISOString()
      : null,
    deadline: nullIfEmpty(v.deadline),
  };

  const { error } = await supabase
    .from("assignments")
    .update(updateRow)
    .eq("id", v.id);

  if (error) {
    return {
      ok: false,
      error: mapAssignmentError(error, "Could not save the assignment."),
    };
  }

  // Replace recipients on every save (covers the case where recipients changed).
  const recRes = await replaceRecipients(
    supabase,
    v.id,
    v.recipientUserIds,
    leader.teamId,
  );
  if (!recRes.ok) {
    revalidatePath("/admin/assignments");
    revalidatePath("/assignments");
    return { ok: false, error: recRes.error };
  }

  revalidatePath("/admin/assignments");
  revalidatePath("/admin/assignments/" + v.id + "/edit");
  revalidatePath("/assignments");
  revalidatePath("/assignments/" + v.id);
  return { ok: true };
}

/** Publish (or re-publish) an assignment with explicit recipients. */
export async function publishAssignmentAction(
  values: PublishAssignmentValues,
): Promise<AssignmentActionResult> {
  const leader = await requireLeader();
  if (!leader.ok) return leader;

  const parsed = publishAssignmentSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  // First, replace recipients (validation happens inside).
  const recRes = await replaceRecipients(
    supabase,
    v.assignmentId,
    v.recipientUserIds,
    leader.teamId,
  );
  if (!recRes.ok) return recRes;

  const { error } = await supabase
    .from("assignments")
    .update({
      publication_status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", v.assignmentId);

  if (error) {
    return {
      ok: false,
      error: mapAssignmentError(error, "Could not publish the assignment."),
    };
  }

  revalidatePath("/admin/assignments");
  revalidatePath("/admin/assignments/" + v.assignmentId + "/edit");
  revalidatePath("/assignments");
  revalidatePath("/assignments/" + v.assignmentId);
  return { ok: true };
}

/** Soft delete: archive the assignment (publication_status='archived'). */
export async function archiveAssignmentAction(
  values: { assignmentId: string },
): Promise<AssignmentActionResult> {
  const leader = await requireLeader();
  if (!leader.ok) return leader;

  const parsed = assignmentIdSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid assignment id." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("assignments")
    .update({ publication_status: "archived" })
    .eq("id", parsed.data.assignmentId);

  if (error) {
    return {
      ok: false,
      error: mapAssignmentError(error, "Could not archive the assignment."),
    };
  }
  revalidatePath("/admin/assignments");
  revalidatePath("/assignments");
  return { ok: true };
}

/**
 * Hard delete (allowed by RLS). Prefer archiveAssignmentAction for audit trail.
 * Provided here as a destructive fallback.
 */
export async function deleteAssignmentAction(
  values: { assignmentId: string },
): Promise<AssignmentActionResult> {
  const leader = await requireLeader();
  if (!leader.ok) return leader;

  const parsed = assignmentIdSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid assignment id." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", parsed.data.assignmentId);

  if (error) {
    return {
      ok: false,
      error: mapAssignmentError(error, "Could not delete the assignment."),
    };
  }
  revalidatePath("/admin/assignments");
  revalidatePath("/assignments");
  return { ok: true, redirectTo: "/admin/assignments" };
}

/**
 * Translate PostgREST errors into friendly messages.
 * The migration's assignments_notify trigger references `new.status`
 * (a non-existent column on `assignments`); that surfaces as a 42883
 * ("function / does not exist") or P0001 ("record new has no field…").
 * We surface a clear, actionable message when that pattern appears.
 */
function mapAssignmentError(
  error: { code?: string; message?: string } | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  const msg = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";
  if (
    code === "42883" ||
    code === "42P10" ||
    code === "P0001" ||
    msg.includes("has no field") ||
    msg.includes("does not exist")
  ) {
    return "Database trigger error on the assignments table. The notify_on_assignment_publish trigger references a non-existent column; ask an administrator to recreate it using publication_status instead of status.";
  }
  return fallback;
}
