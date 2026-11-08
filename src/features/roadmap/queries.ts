import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Phase,
  Week,
  Topic,
  LearningResource,
  TopicProgress,
} from "@/types/database";

// Label maps live in labels.ts so client components can import them without
// pulling in the Supabase server client. Re-exported here for server callers
// that already import from queries.ts.
export {
  phaseStatusLabels,
  weekStatusLabels,
  publicationStatusLabels,
  topicDifficultyLabels,
  resourceTypeLabels,
} from "./labels";

/**
 * Roadmap server-side queries.
 *
 * All reads go through the request-scoped Supabase client so RLS is enforced
 * as the acting user. Members see only `published` rows; leaders/admins see
 * draft rows too (RLS policy in 0002_roadmap.sql).
 *
 * Joined shapes use `as unknown as` because the hand-written types in
 * @/types/database declare jsonb arrays as `string[]` (the generated types
 * would return `Json`). The runtime shape is identical.
 */

export type WeekWithPhase = Week & {
  phases: Pick<Phase, "id" | "title" | "phase_number"> | null;
};

export type TopicWithProgress = Topic & {
  progress: TopicProgress | null;
};

export type TopicWithResources = Topic & {
  learning_resources: LearningResource[];
};

export type WeekDetail = Week & {
  phases: Pick<Phase, "id" | "title" | "phase_number"> | null;
  topics: TopicWithResources[];
};

export type TopicDetail = Topic & {
  weeks:
    | (Pick<Week, "id" | "title" | "week_number"> & {
        phases: Pick<Phase, "id" | "title" | "phase_number"> | null;
      })
    | null;
  learning_resources: LearningResource[];
};

/** All phases for the caller's team, ordered by phase_number then display_order. */
export async function getPhases(): Promise<Phase[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("phases")
    .select("*")
    .order("phase_number", { ascending: true })
    .order("display_order", { ascending: true });
  return (data ?? []) as unknown as Phase[];
}

/**
 * Weeks for the caller's team. Optionally scoped to a phase.
 * Always joined to its phase for context (title, phase_number).
 */
export async function getWeeks(phaseId?: string): Promise<WeekWithPhase[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("weeks")
    .select("*, phases(id, title, phase_number)")
    .order("week_number", { ascending: true })
    .order("display_order", { ascending: true });
  if (phaseId) {
    query = query.eq("phase_id", phaseId);
  }
  const { data } = await query;
  return (data ?? []) as unknown as WeekWithPhase[];
}

/** All topics for the caller's team, ordered by display_order. */
export async function getTopics(): Promise<Topic[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("topics")
    .select("*")
    .order("display_order", { ascending: true });
  return (data ?? []) as unknown as Topic[];
}

/** A single week with its topics (each with its resources) for the detail page. */
export async function getWeekDetail(weekId: string): Promise<WeekDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("weeks")
    .select(
      "*, phases(id, title, phase_number), topics(*, learning_resources(*))",
    )
    .eq("id", weekId)
    .maybeSingle();
  if (!data) return null;
  const week = data as unknown as WeekDetail;
  // Sort topics + resources by display_order (supabase doesn't always preserve
  // joined order reliably across PG versions).
  week.topics = (week.topics ?? []).slice().sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  for (const t of week.topics) {
    t.learning_resources = (t.learning_resources ?? []).slice().sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
    );
  }
  return week;
}

/** A single topic with its resources, week, and phase context. */
export async function getTopicDetail(topicId: string): Promise<TopicDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("topics")
    .select(
      "*, weeks(id, title, week_number, phases(id, title, phase_number)), learning_resources(*)",
    )
    .eq("id", topicId)
    .maybeSingle();
  if (!data) return null;
  const topic = data as unknown as TopicDetail;
  topic.learning_resources = (topic.learning_resources ?? []).slice().sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  return topic;
}

/**
 * All topic_progress rows for the given user. RLS allows a user to read their
 * own rows, and allows leaders/admins to read all team progress; the explicit
 * `.eq("user_id", userId)` filter narrows the leader view to their own rows
 * so the UI shows personal progress, not the whole team's.
 */
export async function getTopicProgressForUser(
  userId: string,
): Promise<TopicProgress[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("topic_progress")
    .select("*")
    .eq("user_id", userId);
  return (data ?? []) as unknown as TopicProgress[];
}

/** Resolve a team's configured "current week" (team_settings.current_week_id). */
export async function getCurrentWeek(teamId: string): Promise<Week | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("team_settings")
    .select("current_week_id, weeks(*)")
    .eq("team_id", teamId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as { weeks: Week | null };
  return row.weeks ?? null;
}

/** All learning resources for a topic (used by admin inline resource form). */
export async function getResourcesForTopic(
  topicId: string,
): Promise<LearningResource[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("learning_resources")
    .select("*")
    .eq("topic_id", topicId)
    .order("display_order", { ascending: true });
  return (data ?? []) as unknown as LearningResource[];
}

// Label maps are re-exported above (from ./labels) for server-side convenience.
