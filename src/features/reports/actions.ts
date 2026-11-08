"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import {
  weeklyReportSchema,
  leaderFeedbackSchema,
  type WeeklyReportValues,
} from "./schemas";

export type ReportActionResult =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: string };

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

async function requireLeaderOrAdmin(): Promise<
  | { ok: true; teamId: string; userId: string }
  | { ok: false; error: string }
> {
  const active = await requireActive();
  if (!active.ok) return active;
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return { ok: false, error: "Session expired." };
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return { ok: false, error: "Only leaders and admins can perform this action." };
  }
  return { ok: true, teamId: ctx.membership.team_id, userId: ctx.userId };
}

/**
 * Upsert the current user's report for a week. Sets submitted_at = now on
 * insert. Only the member's own content is written — leader_feedback is
 * never touched by this action.
 *
 * The unique (user_id, week_id) constraint means a member has exactly one
 * report per week; on update we preserve submitted_at (the original submit
 * time) and only refresh updated_at via the trigger.
 */
export async function saveReportAction(
  weekId: string,
  values: WeeklyReportValues,
): Promise<ReportActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  // Validate the weekId shape first.
  if (!/^[0-9a-f-]{36}$/i.test(weekId)) {
    return { ok: false, error: "Invalid week id." };
  }

  const parsed = weeklyReportSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  // Round hours_spent to one decimal place (matches numeric(5,1)).
  const hoursSpent = Math.round(v.hours_spent * 10) / 10;

  const supabase = await createSupabaseServerClient();

  // Confirm the week exists and belongs to the caller's team (RLS enforces
  // this, but we want a clean error if it's missing).
  const { data: week } = await supabase
    .from("weeks")
    .select("id, team_id")
    .eq("id", weekId)
    .maybeSingle();

  if (!week) {
    return { ok: false, error: "That week does not exist." };
  }
  if (week.team_id !== user.teamId) {
    return { ok: false, error: "That week is not in your team." };
  }

  // Look for an existing report.
  const { data: existing } = await supabase
    .from("weekly_reports")
    .select("id")
    .eq("week_id", weekId)
    .eq("user_id", user.userId)
    .maybeSingle();

  const payload = {
    team_id: user.teamId,
    user_id: user.userId,
    week_id: weekId,
    learned: v.learned?.trim() ? v.learned.trim() : null,
    topics_completed: v.topics_completed.map((s) => s.trim()).filter(Boolean),
    exercises_completed: v.exercises_completed.map((s) => s.trim()).filter(Boolean),
    assignments_completed: v.assignments_completed.map((s) => s.trim()).filter(Boolean),
    hours_spent: hoursSpent,
    biggest_achievement: v.biggest_achievement?.trim()
      ? v.biggest_achievement.trim()
      : null,
    main_difficulty: v.main_difficulty?.trim() ? v.main_difficulty.trim() : null,
    current_blockers: v.current_blockers?.trim()
      ? v.current_blockers.trim()
      : null,
    questions: v.questions?.trim() ? v.questions.trim() : null,
    next_week_goals: v.next_week_goals?.trim() ? v.next_week_goals.trim() : null,
    github_links: v.github_links.map((s) => s.trim()).filter(Boolean),
  };

  if (existing) {
    const { error } = await supabase
      .from("weekly_reports")
      // Intentionally omit leader_feedback — only the member's own fields.
      .update({
        learned: payload.learned,
        topics_completed: payload.topics_completed,
        exercises_completed: payload.exercises_completed,
        assignments_completed: payload.assignments_completed,
        hours_spent: payload.hours_spent,
        biggest_achievement: payload.biggest_achievement,
        main_difficulty: payload.main_difficulty,
        current_blockers: payload.current_blockers,
        questions: payload.questions,
        next_week_goals: payload.next_week_goals,
        github_links: payload.github_links,
        // Refresh submitted_at on each save so leaders see the latest update.
        submitted_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return { ok: false, error: "Could not update the report." };
    }
  } else {
    const { error } = await supabase.from("weekly_reports").insert({
      ...payload,
      submitted_at: new Date().toISOString(),
    });

    if (error) {
      // unique_violation — race with a concurrent insert.
      if (error.code === "23505") {
        return {
          ok: false,
          error: "A report for this week already exists. Refresh and try again.",
        };
      }
      return { ok: false, error: "Could not save the report." };
    }
  }

  revalidatePath("/weekly-reports");
  revalidatePath(`/weekly-reports/${weekId}`);
  return { ok: true, redirectTo: `/weekly-reports/${weekId}` };
}

/**
 * Leader/admin only. Updates ONLY the leader_feedback column on a member's
 * report. The RLS policy permits leaders/admins to update weekly_reports; this
 * action enforces at the app layer that they only touch leader_feedback, never
 * the member's content.
 */
export async function addLeaderFeedbackAction(
  reportId: string,
  feedback: string,
): Promise<ReportActionResult> {
  const leader = await requireLeaderOrAdmin();
  if (!leader.ok) return leader;

  const parsed = leaderFeedbackSchema.safeParse({ feedback });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid feedback." };
  }

  if (!/^[0-9a-f-]{36}$/i.test(reportId)) {
    return { ok: false, error: "Invalid report id." };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch the report to confirm team + grab week_id for revalidation.
  const { data: report } = await supabase
    .from("weekly_reports")
    .select("id, week_id, team_id")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) {
    return { ok: false, error: "Report not found." };
  }
  if (report.team_id !== leader.teamId) {
    return { ok: false, error: "Report is not in your team." };
  }

  const { error } = await supabase
    .from("weekly_reports")
    .update({
      leader_feedback: parsed.data.feedback.trim(),
      // Touch updated_at explicitly to be safe (trigger also fires).
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) {
    return { ok: false, error: "Could not save leader feedback." };
  }

  revalidatePath("/weekly-reports");
  revalidatePath(`/weekly-reports/${report.week_id}`);
  if (report.week_id) {
    revalidatePath(`/weekly-reports/${report.week_id}?user=`);
  }
  return { ok: true };
}
