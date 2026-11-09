import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import type { BlockerPriority, BlockerStatus, MemberWithProfile, Profile, SubmissionStatus } from "@/types/database";

/** Fetch all members of the caller's team, with profile data. */
export async function getMembers(): Promise<MemberWithProfile[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("team_members")
    .select(
      "*, profiles(id, full_name, username, avatar_url, github_username, created_at)",
    )
    .order("created_at", { ascending: true });

  if (error) throw new Error("Could not load squad members.");

  const members = (data ?? []) as unknown as MemberWithProfile[];
  const { data: contacts, error: contactsError } = await supabase.rpc("get_pending_member_contacts");
  if (contactsError) throw new Error("Could not load pending request contacts.");
  const contactByUserId = new Map<string, { user_id: string; full_name: string | null; email: string | null }>(
    ((contacts ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null }>)
      .map((contact) => [contact.user_id, contact]),
  );

  return members.map((member) => {
    if (member.membership_status !== "pending_approval") return member;
    const contact = contactByUserId.get(member.user_id);
    return {
      ...member,
      profiles: member.profiles
        ? { ...member.profiles, full_name: contact?.full_name ?? member.profiles.full_name, email: contact?.email ?? null }
        : contact
          ? { id: member.user_id, full_name: contact.full_name, username: null, avatar_url: null, github_username: null, created_at: member.created_at, email: contact.email }
          : null,
    } as MemberWithProfile;
  });
}

export type AdminMemberOverview = {
  member: Omit<MemberWithProfile, "profiles"> & {
    profiles: Pick<Profile, "id" | "full_name" | "username" | "avatar_url" | "github_username" | "github_profile_url" | "capstone_repository_url" | "bio" | "created_at"> | null;
  };
  currentPhase: { title: string; phaseNumber: number } | null;
  completedTopics: number;
  totalTopics: number;
  approvedAssignments: number;
  totalSubmissions: number;
  totalReports: number;
  openBlockers: number;
  submissions: Array<{ id: string; status: SubmissionStatus; submitted_at: string | null; assignment: { title: string } | null }>;
  reports: Array<{ id: string; week_id: string; submitted_at: string; hours_spent: number; week: { title: string; week_number: number } | null }>;
  blockers: Array<{ id: string; title: string; status: BlockerStatus; priority: BlockerPriority; created_at: string }>;
};

/** Admin/leader-only view of one member's team-scoped learning history. */
export async function getAdminMemberOverview(userId: string): Promise<AdminMemberOverview | null> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active" || (ctx.membership.role !== "admin" && ctx.membership.role !== "leader")) return null;

  const supabase = await createSupabaseServerClient();
  const { data: memberData, error: memberError } = await supabase
    .from("team_members")
    .select("*, profiles(id, full_name, username, avatar_url, github_username, github_profile_url, capstone_repository_url, bio, created_at)")
    .eq("team_id", ctx.membership.team_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) throw new Error("Could not load this member profile.");
  if (!memberData) return null;

  const [settings, weeks, topics, progress, submissions, submissionCount, approvedCount, reports, reportCount, blockers, openBlockerCount] = await Promise.all([
    supabase.from("team_settings").select("current_week_id").eq("team_id", ctx.membership.team_id).maybeSingle(),
    supabase.from("weeks").select("id, phases(title, phase_number)").eq("team_id", ctx.membership.team_id).eq("status", "published"),
    supabase.from("topics").select("id, week_id").eq("team_id", ctx.membership.team_id).eq("publication_status", "published"),
    supabase.from("topic_progress").select("topic_id, status").eq("user_id", userId),
    supabase.from("submissions").select("id, status, submitted_at, assignments(title)").eq("team_id", ctx.membership.team_id).eq("user_id", userId).order("submitted_at", { ascending: false, nullsFirst: false }).limit(8),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("team_id", ctx.membership.team_id).eq("user_id", userId),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("team_id", ctx.membership.team_id).eq("user_id", userId).eq("status", "approved"),
    supabase.from("weekly_reports").select("id, week_id, submitted_at, hours_spent, weeks(title, week_number)").eq("team_id", ctx.membership.team_id).eq("user_id", userId).order("submitted_at", { ascending: false }).limit(6),
    supabase.from("weekly_reports").select("id", { count: "exact", head: true }).eq("team_id", ctx.membership.team_id).eq("user_id", userId),
    supabase.from("blockers").select("id, title, status, priority, created_at").eq("team_id", ctx.membership.team_id).eq("user_id", userId).order("created_at", { ascending: false }).limit(6),
    supabase.from("blockers").select("id", { count: "exact", head: true }).eq("team_id", ctx.membership.team_id).eq("user_id", userId).in("status", ["open", "being_addressed"]),
  ]);
  const results = [settings, weeks, topics, progress, submissions, submissionCount, approvedCount, reports, reportCount, blockers, openBlockerCount];
  if (results.some((result) => result.error)) throw new Error("Could not load this member's learning history.");

  const weekRows = (weeks.data ?? []) as unknown as Array<{ id: string; phases: { title: string; phase_number: number } | null }>;
  const currentWeekId = settings.data?.current_week_id;
  const phase = weekRows.find((week) => week.id === currentWeekId)?.phases ?? null;
  const publishedWeeks = new Set(weekRows.map((week) => week.id));
  const topicRows = (topics.data ?? []).filter((topic) => publishedWeeks.has(topic.week_id));
  const topicIds = new Set(topicRows.map((topic) => topic.id));
  const completedTopics = new Set((progress.data ?? []).filter((row) => row.status === "completed" && topicIds.has(row.topic_id)).map((row) => row.topic_id)).size;

  return {
    member: memberData as unknown as AdminMemberOverview["member"],
    currentPhase: phase ? { title: phase.title, phaseNumber: phase.phase_number } : null,
    completedTopics,
    totalTopics: topicRows.length,
    approvedAssignments: approvedCount.count ?? 0,
    totalSubmissions: submissionCount.count ?? 0,
    totalReports: reportCount.count ?? 0,
    openBlockers: openBlockerCount.count ?? 0,
    submissions: (submissions.data ?? []) as unknown as AdminMemberOverview["submissions"],
    reports: (reports.data ?? []) as unknown as AdminMemberOverview["reports"],
    blockers: (blockers.data ?? []) as unknown as AdminMemberOverview["blockers"],
  };
}
