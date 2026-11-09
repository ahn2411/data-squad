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
  "id" | "full_name" | "username" | "avatar_url"
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

export const REPORT_PAGE_SIZE = 20;
export type ReportPage = {
  reports: ReportWithProfile[];
  totalCount: number;
  page: number;
  pageSize: number;
};

/** A lightweight shape used by the member list (which weeks have a report). */
export type MyReportStub = Pick<
  WeeklyReport,
  "id" | "week_id" | "submitted_at" | "updated_at"
>;

export type MissingReportMember = {
  userId: string;
  name: string;
};

/**
 * Published weeks for the caller's team, ordered by week_number. Used to
 * populate the "select a week to report on" list. RLS on weeks lets active
 * members see published rows; leaders/admins see drafts too.
 */
export async function getWeeksForReport(): Promise<WeekWithPhaseLite[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("weeks")
    .select(
      "id, title, week_number, slug, overview, objectives, start_date, end_date, status, phases(id, title, phase_number)",
    )
    .eq("status", "published")
    .order("week_number", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) throw new Error("Could not load reporting weeks.");

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
  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("week_id", weekId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error) throw new Error("Could not load your weekly report.");

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
  const { data, error } = await supabase
    .from("weekly_reports")
    .select("id, week_id, submitted_at, updated_at")
    .eq("user_id", ctx.userId);

  if (error) throw new Error("Could not load your report history.");

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
  search?: string;
}, requestedPage = 1): Promise<ReportPage> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return { reports: [], totalCount: 0, page: 1, pageSize: REPORT_PAGE_SIZE };
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return { reports: [], totalCount: 0, page: 1, pageSize: REPORT_PAGE_SIZE };
  }

  const supabase = await createSupabaseServerClient();
  const safePage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1_000_000) : 1;
  const safeSearch = (filters?.search ?? "").replace(/[%,_*()!\\]/g, "").trim();
  const select = "*, profiles:profiles!weekly_reports_user_id_fkey(id, full_name, username, avatar_url), weeks:weeks!weekly_reports_week_id_fkey(id, title, week_number)";
  const buildQuery = () => {
    let query = supabase.from("weekly_reports").select(select, { count: "exact" });
    if (filters?.weekId) query = query.eq("week_id", filters.weekId);
    if (filters?.userId) query = query.eq("user_id", filters.userId);
    return query.order("submitted_at", { ascending: false, nullsFirst: false });
  };
  if (filters?.search && !safeSearch) return { reports: [], totalCount: 0, page: 1, pageSize: REPORT_PAGE_SIZE };
  let query = buildQuery();
  if (safeSearch) {
    const pattern = `%${safeSearch}%`;
    const [textMatches, profileMatches, weekMatches] = await Promise.all([
      buildQuery().or(["learned", "biggest_achievement", "main_difficulty", "current_blockers", "questions", "next_week_goals"].map((column) => `${column}.ilike.${pattern}`).join(",")),
      supabase.from("profiles").select("id").or(`full_name.ilike.${pattern},username.ilike.${pattern}`),
      supabase.from("weeks").select("id").ilike("title", pattern),
    ]);
    if (textMatches.error || profileMatches.error || weekMatches.error) throw new Error("Could not search team reports.");
    const ids = new Set((textMatches.data ?? []).map((row) => row.id));
    const userIds = (profileMatches.data ?? []).map((row) => row.id);
    const weekIds = (weekMatches.data ?? []).map((row) => row.id);
    const [byUser, byWeek] = await Promise.all([
      userIds.length ? buildQuery().in("user_id", userIds) : Promise.resolve({ data: [], error: null }),
      weekIds.length ? buildQuery().in("week_id", weekIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (byUser.error || byWeek.error) throw new Error("Could not search team reports.");
    for (const row of byUser.data ?? []) ids.add(row.id);
    for (const row of byWeek.data ?? []) ids.add(row.id);
    if (ids.size === 0) {
      return { reports: [], totalCount: 0, page: 1, pageSize: REPORT_PAGE_SIZE };
    }
    query = buildQuery().in("id", [...ids]);
  }
  const runPage = (page: number) => query.range((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE - 1);
  const initial = await runPage(safePage);
  if (initial.error) throw new Error("Could not load team reports.");
  const totalCount = initial.count ?? 0;
  const page = Math.min(safePage, Math.max(1, Math.ceil(totalCount / REPORT_PAGE_SIZE)));
  const result = page === safePage ? initial : await runPage(page);
  if (result.error) throw new Error("Could not load team reports.");
  return { reports: (result.data ?? []) as unknown as ReportWithProfile[], totalCount, page, pageSize: REPORT_PAGE_SIZE };
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
  const { data, error } = await supabase
    .from("weekly_reports")
    .select(
      "*, profiles:profiles!weekly_reports_user_id_fkey(id, full_name, username, avatar_url), weeks:weeks!weekly_reports_week_id_fkey(id, title, week_number)",
    )
    .eq("week_id", weekId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("Could not load this weekly report.");

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

  const { count: total, error: totalError } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", ctx.membership.team_id)
    .eq("membership_status", "active");

  const { count: submitted, error: submittedError } = await supabase
    .from("weekly_reports")
    .select("id", { count: "exact", head: true })
    .eq("week_id", weekId);

  if (totalError || submittedError) {
    throw new Error("Could not load report completion totals.");
  }

  return { submitted: submitted ?? 0, total: total ?? 0 };
}

/** Active team members with no report for a selected week (leader/admin only). */
export async function getMissingReportMembers(weekId: string): Promise<MissingReportMember[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active" || (ctx.membership.role !== "admin" && ctx.membership.role !== "leader")) return [];

  const supabase = await createSupabaseServerClient();
  const [membersResult, reportsResult] = await Promise.all([
    supabase.from("team_members")
      .select("user_id, profiles(full_name)")
      .eq("team_id", ctx.membership.team_id)
      .eq("membership_status", "active"),
    supabase.from("weekly_reports")
      .select("user_id")
      .eq("team_id", ctx.membership.team_id)
      .eq("week_id", weekId),
  ]);
  if (membersResult.error || reportsResult.error) {
    throw new Error("Could not load missing weekly reports.");
  }

  const submittedUserIds = new Set((reportsResult.data ?? []).map((report) => report.user_id));
  return ((membersResult.data ?? []) as unknown as Array<{
    user_id: string;
    profiles: { full_name: string | null } | null;
  }>)
    .filter((member) => !submittedUserIds.has(member.user_id))
    .map((member) => ({
      userId: member.user_id,
      name: member.profiles?.full_name ?? "Member",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
