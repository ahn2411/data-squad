import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import type {
  Profile,
  Week,
  WeeklyReport,
} from "@/types/database";

/**
 * Reports server-side queries.
 *
 * All reads go through the request-scoped Supabase client so RLS is enforced
 * as the acting user. Members see only their own reports; leaders/admins see
 * every report in their team.
 */

export type ProfileLite = Pick<
  Profile,
  "id" | "email" | "full_name" | "username" | "avatar_url"
>;

export type PhaseLite = {
  id: string;
  title: string;
  phase_number: number;
};

/** A published week joined to its phase — the shape used by the report list. */
export type WeekWithPhaseLite = Pick<
  Week,
  | "id"
  | "title"
  | "week_number"
  | "slug"
  | "overview"
  | "objectives"
  | "start_date"
  | "end_date"
  | "status"
> & {
  phases: PhaseLite | null;
};

/** A weekly report joined with its author profile + week context. */
export type ReportWithProfile = WeeklyReport & {
  profiles: ProfileLite | null;
  weeks: Pick<Week, "id" | "title" | "week_number"> | null;
};

/** A lightweight shape used by the member list (which weeks have a report). */
export type MyReportStub = Pick<
  WeeklyReport,
  "id" | "week_id" | "submitted_at" | "updated_at"
>;

/**
 * Published weeks for the caller's team, ordered by week_number. Used to
 * populate the "select a week to report on" list. RLS on weeks lets active
 * members see published rows; leaders/admins see drafts too.
 */
export async function getWeeksForReport(): Promise<WeekWithPhaseLite[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("weeks")
    .select(
      "id, title, week_number, slug, overview, objectives, start_date, end_date, status, phases(id, title, phase_number)",
    )
    .eq("status", "published")
    .order("week_number", { ascending: true })
    .order("display_order", { ascending: true });

  return (data ?? []) as unknown as WeekWithPhaseLite[];
}

/**
 * The current user's report for a specific week (or null).
 * RLS allows a user to read their own rows only.
 */
export async function getMyReport(
  weekId: string,
): Promise<WeeklyReport | null> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("week_id", weekId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  return (data as unknown as WeeklyReport) ?? null;
}

/**
 * All of the current user's report stubs (one row per submitted week).
 * Used by the member list page to mark which weeks already have a report.
 */
export async function getMyReportStubs(): Promise<MyReportStub[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("weekly_reports")
    .select("id, week_id, submitted_at, updated_at")
    .eq("user_id", ctx.userId);

  return (data ?? []) as unknown as MyReportStub[];
}

/**
 * All team reports (leader/admin only), joined with profile + week context.
 * Filterable by weekId and/or userId. Ordered by submitted_at desc.
 *
 * RLS allows leaders/admins to read every report in their team; the explicit
 * role guard here short-circuits for members so they don't get an empty
 * filtered result that looks like "no reports" when really they just can't
 * see them.
 */
export async function getAllReports(filters?: {
  weekId?: string;
  userId?: string;
}): Promise<ReportWithProfile[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("weekly_reports")
    .select(
      "*, profiles:profiles!weekly_reports_user_id_fkey(id, email, full_name, username, avatar_url), weeks:weeks!weekly_reports_week_id_fkey(id, title, week_number)",
    )
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (filters?.weekId) {
    query = query.eq("week_id", filters.weekId);
  }
  if (filters?.userId) {
    query = query.eq("user_id", filters.userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as ReportWithProfile[];
}

/**
 * A single report (leader/admin view of another member's report). Returns null
 * if the caller is not a leader/admin or the report doesn't exist.
 */
export async function getReportForUser(
  weekId: string,
  userId: string,
): Promise<ReportWithProfile | null> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return null;
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("weekly_reports")
    .select(
      "*, profiles:profiles!weekly_reports_user_id_fkey(id, email, full_name, username, avatar_url), weeks:weeks!weekly_reports_week_id_fkey(id, title, week_number)",
    )
    .eq("week_id", weekId)
    .eq("user_id", userId)
    .maybeSingle();

  return (data as unknown as ReportWithProfile) ?? null;
}

/**
 * Completion stats for a week: how many active team members submitted a report
 * vs. the total active member count. Leader/admin only (members can only see
 * their own reports per RLS, so the submitted count would always be 0 or 1).
 */
export async function getReportCompletion(
  weekId: string,
): Promise<{ submitted: number; total: number }> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return { submitted: 0, total: 0 };
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return { submitted: 0, total: 0 };
  }

  const supabase = await createSupabaseServerClient();

  const { count: total } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", ctx.membership.team_id)
    .eq("membership_status", "active");

  const { count: submitted } = await supabase
    .from("weekly_reports")
    .select("id", { count: "exact", head: true })
    .eq("week_id", weekId);

  return { submitted: submitted ?? 0, total: total ?? 0 };
}
