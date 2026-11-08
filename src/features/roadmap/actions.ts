"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import type {
  TopicStatus,
  TopicProgress,
  PhaseStatus,
  WeekStatus,
  PublicationStatus,
} from "@/types/database";
import {
  savePhaseSchema,
  saveWeekSchema,
  saveTopicSchema,
  saveResourceSchema,
  publishPhaseSchema,
  publishWeekSchema,
  publishTopicSchema,
  deletePhaseSchema,
  deleteWeekSchema,
  deleteTopicSchema,
  deleteResourceSchema,
  topicIdSchema,
  type SavePhaseValues,
  type SaveWeekValues,
  type SaveTopicValues,
  type SaveResourceValues,
  type PublishPhaseValues,
  type PublishWeekValues,
  type PublishTopicValues,
} from "./schemas";

export type RoadmapActionResult =
  | { ok: true }
  | { ok: false; error: string };

// ────────────────────────────── Guards ──────────────────────────────
async function requireActive(): Promise<
  | { ok: true; userId: string; teamId: string }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { ok: false, error: "You must be an active member." };
  }
  return { ok: true, userId: ctx.userId, teamId: ctx.membership.team_id };
}

async function requireLeaderOrAdmin(): Promise<
  | { ok: true; userId: string; teamId: string }
  | { ok: false; error: string }
> {
  const active = await requireActive();
  if (!active.ok) return active;
  // active.ok === true here, but TS needs the narrowing.
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return { ok: false, error: "Session expired." };
  const role = ctx.membership.role;
  if (role !== "admin" && role !== "leader") {
    return { ok: false, error: "Only leaders and admins can manage the roadmap." };
  }
  return { ok: true, userId: ctx.userId, teamId: ctx.membership.team_id };
}

function describeError(
  error: { code?: string; message?: string } | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  // 23505 = unique_violation
  if (error.code === "23505") {
    return "A row with that slug or number already exists for this team.";
  }
  // 23503 = foreign_key_violation
  if (error.code === "23503") {
    return "The referenced parent does not exist (or was deleted).";
  }
  return fallback;
}

// ────────────────────────────── Topic progress (self) ──────────────────────────────
/**
 * Internal: upsert a topic_progress row, preserving any prior started_at when
 * the caller does not explicitly override it. Completion is a deliberate user
 * action — this is the only path that flips status to `completed`.
 */
async function upsertProgress(
  userId: string,
  topicId: string,
  update: {
    status: TopicStatus;
    startedAt?: string | null;
    completedAt?: string | null;
  },
): Promise<RoadmapActionResult> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  // Read existing (the caller owns their rows; RLS allows it).
  const { data: existing } = await supabase
    .from("topic_progress")
    .select("id, started_at, completed_at, status")
    .eq("topic_id", topicId)
    .eq("user_id", userId)
    .maybeSingle();

  const prior = existing as Pick<
    TopicProgress,
    "id" | "started_at" | "completed_at" | "status"
  > | null;

  // Resolve started_at: explicit override > prior > now (if transitioning to active-ish)
  const startedAt =
    update.startedAt !== undefined
      ? update.startedAt
      : (prior?.started_at ??
          (update.status === "in_progress" || update.status === "completed" ? now : null));

  // Resolve completed_at: explicit override > prior (if still completed) > now (if completed)
  const completedAt =
    update.completedAt !== undefined
      ? update.completedAt
      : update.status === "completed"
        ? (prior?.completed_at ?? now)
        : null;

  const payload = {
    topic_id: topicId,
    user_id: userId,
    status: update.status,
    started_at: startedAt,
    completed_at: completedAt,
  };

  if (prior) {
    const { error } = await supabase
      .from("topic_progress")
      .update(payload)
      .eq("id", prior.id);
    if (error) return { ok: false, error: "Could not update your progress." };
  } else {
    const { error } = await supabase.from("topic_progress").insert(payload);
    if (error) return { ok: false, error: "Could not record your progress." };
  }

  revalidatePath("/roadmap");
  return { ok: true };
}

/** Mark a topic as started (status = in_progress). */
export async function markTopicStartedAction(
  topicId: string,
): Promise<RoadmapActionResult> {
  const active = await requireActive();
  if (!active.ok) return active;
  const parsed = topicIdSchema.safeParse(topicId);
  if (!parsed.success) return { ok: false, error: "Invalid topic id." };
  return upsertProgress(active.userId, parsed.data, {
    status: "in_progress",
    completedAt: null,
  });
}

/** Mark a topic as completed (status = completed). Deliberate user action. */
export async function markTopicCompletedAction(
  topicId: string,
): Promise<RoadmapActionResult> {
  const active = await requireActive();
  if (!active.ok) return active;
  const parsed = topicIdSchema.safeParse(topicId);
  if (!parsed.success) return { ok: false, error: "Invalid topic id." };
  return upsertProgress(active.userId, parsed.data, { status: "completed" });
}

/** Reset (delete) the caller's progress row for a topic. */
export async function resetTopicProgressAction(
  topicId: string,
): Promise<RoadmapActionResult> {
  const active = await requireActive();
  if (!active.ok) return active;
  const parsed = topicIdSchema.safeParse(topicId);
  if (!parsed.success) return { ok: false, error: "Invalid topic id." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("topic_progress")
    .delete()
    .eq("topic_id", parsed.data)
    .eq("user_id", active.userId);
  if (error) return { ok: false, error: "Could not reset your progress." };
  revalidatePath("/roadmap");
  return { ok: true };
}

// ────────────────────────────── Phase CRUD ──────────────────────────────
export async function savePhaseAction(
  values: SavePhaseValues,
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = savePhaseSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const payload = {
    team_id: leader.teamId,
    title: v.title,
    slug: v.slug,
    description: v.description ? v.description : null,
    phase_number: v.phaseNumber,
    start_week: v.startWeek,
    end_week: v.endWeek,
    status: v.status,
    display_order: v.displayOrder,
  };
  if (v.id) {
    const { error } = await supabase
      .from("phases")
      .update(payload)
      .eq("id", v.id)
      .eq("team_id", leader.teamId);
    if (error) return { ok: false, error: describeError(error, "Could not save the phase.") };
  } else {
    const { error } = await supabase.from("phases").insert(payload);
    if (error) return { ok: false, error: describeError(error, "Could not create the phase.") };
  }
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function publishPhaseAction(
  values: PublishPhaseValues,
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = publishPhaseSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("phases")
    .update({ status: parsed.data.status as PhaseStatus })
    .eq("id", parsed.data.id)
    .eq("team_id", leader.teamId);
  if (error) return { ok: false, error: "Could not update the phase status." };
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function deletePhaseAction(
  values: { id: string },
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = deletePhaseSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid phase id." };
  const supabase = await createSupabaseServerClient();
  // ON DELETE CASCADE removes weeks → topics → resources / topic_progress.
  const { error } = await supabase
    .from("phases")
    .delete()
    .eq("id", parsed.data.id)
    .eq("team_id", leader.teamId);
  if (error) return { ok: false, error: describeError(error, "Could not delete the phase.") };
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

// ────────────────────────────── Week CRUD ──────────────────────────────
export async function saveWeekAction(
  values: SaveWeekValues,
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = saveWeekSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const payload = {
    team_id: leader.teamId,
    phase_id: v.phaseId,
    title: v.title,
    slug: v.slug,
    overview: v.overview ? v.overview : null,
    objectives: v.objectives,
    deliverables: v.deliverables,
    completion_criteria: v.completionCriteria,
    week_number: v.weekNumber,
    start_date: v.startDate ?? null,
    end_date: v.endDate ?? null,
    status: v.status,
    display_order: v.displayOrder,
  };
  if (v.id) {
    const { error } = await supabase
      .from("weeks")
      .update(payload)
      .eq("id", v.id)
      .eq("team_id", leader.teamId);
    if (error) return { ok: false, error: describeError(error, "Could not save the week.") };
  } else {
    const { error } = await supabase.from("weeks").insert(payload);
    if (error) return { ok: false, error: describeError(error, "Could not create the week.") };
  }
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function publishWeekAction(
  values: PublishWeekValues,
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = publishWeekSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("weeks")
    .update({ status: parsed.data.status as WeekStatus })
    .eq("id", parsed.data.id)
    .eq("team_id", leader.teamId);
  if (error) return { ok: false, error: "Could not update the week status." };
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function deleteWeekAction(
  values: { id: string },
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = deleteWeekSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid week id." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("weeks")
    .delete()
    .eq("id", parsed.data.id)
    .eq("team_id", leader.teamId);
  if (error) return { ok: false, error: describeError(error, "Could not delete the week.") };
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

// ────────────────────────────── Topic CRUD ──────────────────────────────
export async function saveTopicAction(
  values: SaveTopicValues,
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = saveTopicSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const payload = {
    team_id: leader.teamId,
    week_id: v.weekId,
    title: v.title,
    slug: v.slug,
    description: v.description ? v.description : null,
    learning_objectives: v.learningObjectives,
    prerequisites: v.prerequisites,
    completion_criteria: v.completionCriteria,
    practical_exercise: v.practicalExercise ? v.practicalExercise : null,
    estimated_minutes:
      typeof v.estimatedMinutes === "number" ? v.estimatedMinutes : null,
    difficulty: v.difficulty,
    publication_status: v.publicationStatus,
    display_order: v.displayOrder,
  };
  if (v.id) {
    const { error } = await supabase
      .from("topics")
      .update(payload)
      .eq("id", v.id)
      .eq("team_id", leader.teamId);
    if (error) return { ok: false, error: describeError(error, "Could not save the topic.") };
  } else {
    const { error } = await supabase.from("topics").insert(payload);
    if (error) return { ok: false, error: describeError(error, "Could not create the topic.") };
  }
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function publishTopicAction(
  values: PublishTopicValues,
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = publishTopicSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("topics")
    .update({ publication_status: parsed.data.status as PublicationStatus })
    .eq("id", parsed.data.id)
    .eq("team_id", leader.teamId);
  if (error) return { ok: false, error: "Could not update the topic status." };
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function deleteTopicAction(
  values: { id: string },
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = deleteTopicSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid topic id." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("topics")
    .delete()
    .eq("id", parsed.data.id)
    .eq("team_id", leader.teamId);
  if (error) return { ok: false, error: describeError(error, "Could not delete the topic.") };
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

// ────────────────────────────── Learning resource CRUD ──────────────────────────────
export async function saveResourceAction(
  values: SaveResourceValues,
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = saveResourceSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const payload = {
    team_id: leader.teamId,
    topic_id: v.topicId ?? null,
    title: v.title,
    url: v.url,
    resource_type: v.resourceType,
    description: v.description ? v.description : null,
    difficulty: v.difficulty ?? null,
    is_free: v.isFree,
    display_order: v.displayOrder,
  };
  if (v.id) {
    const { error } = await supabase
      .from("learning_resources")
      .update(payload)
      .eq("id", v.id)
      .eq("team_id", leader.teamId);
    if (error) return { ok: false, error: describeError(error, "Could not save the resource.") };
  } else {
    const { error } = await supabase.from("learning_resources").insert(payload);
    if (error) return { ok: false, error: describeError(error, "Could not create the resource.") };
  }
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}

export async function deleteResourceAction(
  values: { id: string },
): Promise<RoadmapActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;
  const parsed = deleteResourceSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid resource id." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("learning_resources")
    .delete()
    .eq("id", parsed.data.id)
    .eq("team_id", leader.teamId);
  if (error) return { ok: false, error: "Could not delete the resource." };
  revalidatePath("/roadmap");
  revalidatePath("/admin/roadmap");
  return { ok: true };
}
