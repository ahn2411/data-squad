import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";

export type LearningAchievement = {
  id: "first-topic" | "first-approved-assignment" | "first-weekly-report";
  title: string;
  detail: string;
  earned: boolean;
};

export type ProfileLearningSummary = {
  currentPhase: { title: string; phaseNumber: number } | null;
  completedTopics: number;
  totalTopics: number;
  approvedAssignments: number;
  submittedReports: number;
  achievements: LearningAchievement[];
};

/**
 * Private, current-member learning summary for their own profile page.
 * All data is read through the request-scoped Supabase client and RLS.
 */
export async function getProfileLearningSummary(): Promise<ProfileLearningSummary> {
  const ctx = await getSessionContext();
  const empty: ProfileLearningSummary = {
    currentPhase: null,
    completedTopics: 0,
    totalTopics: 0,
    approvedAssignments: 0,
    submittedReports: 0,
    achievements: [],
  };
  if (ctx.status !== "active") return empty;

  const supabase = await createSupabaseServerClient();
  const [settingsResult, weeksResult, topicsResult, progressResult, submissionsResult, reportsResult] = await Promise.all([
    supabase.from("team_settings").select("current_week_id").eq("team_id", ctx.membership.team_id).maybeSingle(),
    supabase.from("weeks").select("id, phase_id, phases(id, title, phase_number)")
      .eq("team_id", ctx.membership.team_id).eq("status", "published"),
    supabase.from("topics").select("id, week_id")
      .eq("team_id", ctx.membership.team_id).eq("publication_status", "published"),
    supabase.from("topic_progress").select("topic_id, status")
      .eq("user_id", ctx.userId).eq("status", "completed"),
    supabase.from("submissions").select("id", { count: "exact", head: true })
      .eq("team_id", ctx.membership.team_id).eq("user_id", ctx.userId).eq("status", "approved"),
    supabase.from("weekly_reports").select("id", { count: "exact", head: true })
      .eq("team_id", ctx.membership.team_id).eq("user_id", ctx.userId),
  ]);

  if ([settingsResult, weeksResult, topicsResult, progressResult, submissionsResult, reportsResult].some((result) => result.error)) {
    throw new Error("Could not load your learning profile.");
  }

  const weeks = (weeksResult.data ?? []) as unknown as Array<{
    id: string;
    phases: { id: string; title: string; phase_number: number } | null;
  }>;
  const currentWeekId = settingsResult.data?.current_week_id;
  const currentWeek = weeks.find((week) => week.id === currentWeekId);
  const publishedWeekIds = new Set(weeks.map((week) => week.id));
  const topics = (topicsResult.data ?? []).filter((topic) => publishedWeekIds.has(topic.week_id));
  const topicIds = new Set(topics.map((topic) => topic.id));
  const completedTopics = new Set((progressResult.data ?? [])
    .map((progress) => progress.topic_id)
    .filter((topicId) => topicIds.has(topicId))).size;
  const approvedAssignments = submissionsResult.count ?? 0;
  const submittedReports = reportsResult.count ?? 0;

  return {
    currentPhase: currentWeek?.phases
      ? { title: currentWeek.phases.title, phaseNumber: currentWeek.phases.phase_number }
      : null,
    completedTopics,
    totalTopics: topics.length,
    approvedAssignments,
    submittedReports,
    achievements: [
      { id: "first-topic", title: "First topic complete", detail: "Complete your first roadmap topic.", earned: completedTopics > 0 },
      { id: "first-approved-assignment", title: "First assignment approved", detail: "Receive approval on an assignment submission.", earned: approvedAssignments > 0 },
      { id: "first-weekly-report", title: "First weekly report", detail: "Submit your first weekly learning report.", earned: submittedReports > 0 },
    ],
  };
}
