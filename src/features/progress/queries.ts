import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Assignment,
  AssignmentDifficulty,
  AssignmentType,
  Blocker,
  BlockerPriority,
  BlockerStatus,
  PublicationStatus,
  Review,
  SubmissionStatus,
  TeamMember,
  TeamRole,
  TopicProgress,
} from "@/types/database";

// ─────────────────────────────────────────────────────────────────────────────
// Public return shapes — consumed by the dashboard page (Server Component).
// All counts are derived from real rows. No hardcoded numbers.
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingAssignmentItem {
  id: string;
  title: string;
  deadline: string | null;
  assignment_type: AssignmentType;
  difficulty: AssignmentDifficulty;
  week_id: string | null;
  week_title: string | null;
  week_number: number | null;
}

export interface RecentSubmissionItem {
  id: string;
  status: SubmissionStatus;
  submitted_at: string | null;
  is_late: boolean;
  assignment_id: string;
  assignment_title: string;
  review_feedback: string | null;
  review_status: Review["review_status"] | null;
}

export interface ActiveBlockerItem {
  id: string;
  title: string;
  priority: BlockerPriority;
  status: BlockerStatus;
  created_at: string;
}

export interface RecentAnnouncementItem {
  id: string;
  title: string;
  content: string | null;
  pinned: boolean;
  published_at: string | null;
  author_name: string;
}

export interface PhaseProgressItem {
  phaseId: string;
  phaseTitle: string;
  phaseNumber: number;
  completedTopics: number;
  totalTopics: number;
}

export interface RoadmapProgress {
  completedTopics: number;
  totalTopics: number;
  ratio: number;
}

export interface WeeklyHoursPoint {
  weekId: string;
  weekTitle: string;
  weekNumber: number | null;
  hours: number;
  submittedAt: string;
}

export interface LatestReviewItem {
  reviewId: string;
  reviewStatus: Review["review_status"];
  score: number | null;
  feedback: string | null;
  createdAt: string;
  submissionId: string;
  assignmentTitle: string;
}

export interface MemberDashboardData {
  currentPhase: { id: string; title: string; phase_number: number } | null;
  currentWeek: {
    id: string;
    title: string;
    week_number: number;
    overview: string | null;
    objectives: string[];
  } | null;
  pendingAssignments: PendingAssignmentItem[];
  upcomingDeadlines: PendingAssignmentItem[];
  completedAssignmentsCount: number;
  recentSubmissions: RecentSubmissionItem[];
  activeBlockers: ActiveBlockerItem[];
  recentAnnouncements: RecentAnnouncementItem[];
  unreadNotifications: number;
  roadmapProgress: RoadmapProgress;
  phaseProgress: PhaseProgressItem[];
  weeklyHours: number;
  weeklyHoursByReport: WeeklyHoursPoint[];
  latestReviewFeedback: LatestReviewItem | null;
}

export interface MemberProgressRow {
  userId: string;
  memberId: string;
  name: string;
  role: TeamRole;
  topicsCompleted: number;
  assignmentsApproved: number;
  lastActivity: string | null;
  roadmapRatio: number;
}

export interface AdminActivityItem {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  link: string | null;
}

export interface ReviewQueueItem {
  id: string;
  status: SubmissionStatus;
  assignmentId: string;
  assignmentTitle: string;
  userId: string;
  userName: string;
  updatedAt: string;
  isLate: boolean;
}

export interface AdminDashboardData {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  totalAssignments: number;
  pendingSubmissions: number;
  approvedSubmissionsCount: number;
  currentWeek: { id: string; title: string; week_number: number } | null;
  teamProgress: number;
  memberProgressList: MemberProgressRow[];
  openBlockers: ActiveBlockerItem[];
  recentActivity: AdminActivityItem[];
  reviewQueue: ReviewQueueItem[];
  weeklyReportCompletion: {
    submitted: number;
    totalActive: number;
    ratio: number;
    currentWeekId: string | null;
  };
}

export interface IndividualProgress {
  completedTopics: number;
  totalTopics: number;
  topicsRatio: number;
  completedAssignments: number;
  totalAssigned: number;
  assignmentsRatio: number;
  approvedSubmissions: number;
  totalSubmissions: number;
  reportedHoursSum: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal raw row shapes (what the supabase client returns after a nested
// select). The client is untyped here so we cast via `unknown`.
// ─────────────────────────────────────────────────────────────────────────────

interface RawTopicWithWeekPhase {
  id: string;
  week_id: string;
  weeks: {
    id: string;
    title: string;
    week_number: number;
    phase_id: string;
    phases: { id: string; title: string; phase_number: number } | null;
  } | null;
}

interface RawAssignmentWithWeekAndRecipients {
  id: string;
  title: string;
  deadline: string | null;
  assignment_type: AssignmentType;
  difficulty: AssignmentDifficulty;
  week_id: string | null;
  publication_status: PublicationStatus;
  display_order: number;
  weeks: { title: string; week_number: number } | null;
  assignment_recipients: Array<{ user_id: string }>;
}

interface RawSubmissionWithAssignmentAndReviews {
  id: string;
  status: SubmissionStatus;
  submitted_at: string | null;
  is_late: boolean;
  assignment_id: string;
  updated_at: string;
  assignments: { id: string; title: string } | null;
  reviews: Array<{
    id: string;
    review_status: Review["review_status"];
    feedback: string | null;
    score: number | null;
    created_at: string;
  }>;
}

interface RawWeeklyReportWithWeek {
  id: string;
  week_id: string;
  hours_spent: number;
  submitted_at: string;
  weeks: { title: string; week_number: number } | null;
}

interface RawAnnouncementWithAuthor {
  id: string;
  title: string;
  content: string | null;
  pinned: boolean;
  published_at: string | null;
  profiles: { full_name: string | null } | null;
}

interface RawTopicProgressRow {
  topic_id: string;
  user_id: string;
  status: TopicProgress["status"];
  updated_at: string;
}

interface RawMemberWithProfile {
  id: string;
  user_id: string;
  role: TeamRole;
  membership_status: TeamMember["membership_status"];
  profiles: {
    id: string;
    full_name: string | null;
  } | null;
}

interface RawSubmissionForActivity {
  id: string;
  user_id: string;
  status: SubmissionStatus;
  updated_at: string;
  is_late: boolean | null;
  assignments: { id: string; title: string } | null;
  profiles: { full_name: string | null } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Clamp a 0–1 ratio; returns 0 for empty denominators. */
function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  if (denominator <= 0) return 0;
  const r = numerator / denominator;
  if (!Number.isFinite(r)) return 0;
  return Math.min(Math.max(r, 0), 1);
}

function requireSuccessfulReads(
  results: readonly { error: unknown }[],
): void {
  if (results.some((result) => result.error !== null)) {
    throw new Error("Could not load dashboard data.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMemberDashboardData
// ─────────────────────────────────────────────────────────────────────────────

export async function getMemberDashboardData(
  userId: string,
  teamId: string,
): Promise<MemberDashboardData> {
  const supabase = await createSupabaseServerClient();

  const [
    settingsRes,
    currentWeekRes,
    topicsRes,
    assignmentsRes,
    userSubsRes,
    userProgressRes,
    blockersRes,
    announcementsRes,
    notifRes,
    weeklyReportsRes,
  ] = await Promise.all([
    supabase
      .from("team_settings")
      .select("current_week_id")
      .eq("team_id", teamId)
      .maybeSingle(),
    // current week + phase lookup happens below using current_week_id
    supabase
      .from("weeks")
      .select(
        "id, title, week_number, overview, objectives, phase_id, phases(id, title, phase_number)",
      )
      .eq("team_id", teamId)
      .eq("status", "published")
      .order("week_number", { ascending: true }),
    supabase
      .from("topics")
      .select(
        "id, week_id, weeks!inner(id, title, week_number, phase_id, phases(id, title, phase_number))",
      )
      .eq("team_id", teamId)
      .eq("publication_status", "published"),
    supabase
      .from("assignments")
      .select(
        "id, title, deadline, assignment_type, difficulty, week_id, publication_status, display_order, weeks(title, week_number), assignment_recipients(user_id)",
      )
      .eq("team_id", teamId)
      .eq("publication_status", "published")
      .order("display_order", { ascending: true }),
    supabase
      .from("submissions")
      .select(
        "id, status, submitted_at, is_late, assignment_id, updated_at, assignments!inner(id, title), reviews(id, review_status, feedback, score, created_at)",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("topic_progress")
      .select("topic_id, user_id, status, updated_at")
      .eq("user_id", userId),
    supabase
      .from("blockers")
      .select("id, title, priority, status, created_at")
      .eq("user_id", userId)
      .in("status", ["open", "being_addressed"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("announcements")
      .select(
        "id, title, content, pinned, published_at, profiles(full_name)",
      )
      .eq("team_id", teamId)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(3),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
    supabase
      .from("weekly_reports")
      .select(
        "id, week_id, hours_spent, submitted_at, weeks(title, week_number)",
      )
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false }),
  ]);

  requireSuccessfulReads([
    settingsRes,
    currentWeekRes,
    topicsRes,
    assignmentsRes,
    userSubsRes,
    userProgressRes,
    blockersRes,
    announcementsRes,
    notifRes,
    weeklyReportsRes,
  ]);

  // ── current week + phase ──
  const currentWeekId =
    (settingsRes.data as { current_week_id: string | null } | null)
      ?.current_week_id ?? null;
  const weeks = (currentWeekRes.data ?? []) as unknown as Array<{
    id: string;
    title: string;
    week_number: number;
    overview: string | null;
    objectives: string[];
    phase_id: string;
    phases: { id: string; title: string; phase_number: number } | null;
  }>;
  const currentWeekRow = currentWeekId
    ? (weeks.find((w) => w.id === currentWeekId) ?? null)
    : null;
  const currentWeek = currentWeekRow
    ? {
        id: currentWeekRow.id,
        title: currentWeekRow.title,
        week_number: currentWeekRow.week_number,
        overview: currentWeekRow.overview,
        objectives: currentWeekRow.objectives ?? [],
      }
    : null;
  const currentPhase = currentWeekRow?.phases
    ? {
        id: currentWeekRow.phases.id,
        title: currentWeekRow.phases.title,
        phase_number: currentWeekRow.phases.phase_number,
      }
    : null;

  // ── topics, weeks, phases → roadmap + phase progress ──
  const topics = (topicsRes.data ?? []) as unknown as RawTopicWithWeekPhase[];
  const userProgress = (userProgressRes.data ?? []) as RawTopicProgressRow[];
  const completedTopicIds = new Set(
    userProgress
      .filter((p) => p.status === "completed")
      .map((p) => p.topic_id),
  );

  // group topics by phase
  const phaseMap = new Map<
    string,
    { phaseTitle: string; phaseNumber: number; topicIds: string[] }
  >();
  for (const t of topics) {
    const phase = t.weeks?.phases;
    if (!phase) continue;
    const existing = phaseMap.get(phase.id);
    if (existing) {
      existing.topicIds.push(t.id);
    } else {
      phaseMap.set(phase.id, {
        phaseTitle: phase.title,
        phaseNumber: phase.phase_number,
        topicIds: [t.id],
      });
    }
  }
  const phaseProgress: PhaseProgressItem[] = Array.from(
    phaseMap.entries(),
  ).map(([phaseId, info]) => {
    const total = info.topicIds.length;
    const completed = info.topicIds.filter((id) =>
      completedTopicIds.has(id),
    ).length;
    return {
      phaseId,
      phaseTitle: info.phaseTitle,
      phaseNumber: info.phaseNumber,
      completedTopics: completed,
      totalTopics: total,
    };
  });
  phaseProgress.sort((a, b) => a.phaseNumber - b.phaseNumber);

  const totalTopics = topics.length;
  const completedTopics = topics.filter((t) =>
    completedTopicIds.has(t.id),
  ).length;
  const roadmapProgress: RoadmapProgress = {
    completedTopics,
    totalTopics,
    ratio: safeRatio(completedTopics, totalTopics),
  };

  // ── assignments: pending (assigned + not approved) + upcoming deadlines ──
  const assignments =
    (assignmentsRes.data ?? []) as unknown as RawAssignmentWithWeekAndRecipients[];
  const userSubs = (userSubsRes.data ?? []) as unknown as RawSubmissionWithAssignmentAndReviews[];

  // map assignment_id → user's submission status
  const submissionByAssignment = new Map<
    string,
    RawSubmissionWithAssignmentAndReviews
  >();
  for (const s of userSubs) {
    // userSubs ordered by updated_at desc; first occurrence wins (latest)
    if (!submissionByAssignment.has(s.assignment_id)) {
      submissionByAssignment.set(s.assignment_id, s);
    }
  }

  // "assigned to me" = team-wide (no recipients) OR has recipient = me
  const assignedToMe = assignments.filter((a) => {
    if (a.assignment_recipients.length === 0) return true; // team-wide
    return a.assignment_recipients.some((r) => r.user_id === userId);
  });

  // "pending" = assigned and NOT approved
  const pendingAssignments: PendingAssignmentItem[] = assignedToMe
    .map((a) => toPendingItem(a))
    .filter((item) => {
      const sub = submissionByAssignment.get(item.id);
      return !sub || sub.status !== "approved";
    });

  // upcoming deadlines: pending assignments with a deadline, sorted asc, top 3
  const upcomingDeadlines = pendingAssignments
    .filter((a) => a.deadline !== null)
    .slice()
    .sort((a, b) => {
      const ta = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const tb = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return ta - tb;
    })
    .slice(0, 3);

  // completed assignments count = user's submissions with status='approved'
  const completedAssignmentsCount = userSubs.filter(
    (s) => s.status === "approved",
  ).length;

  // recent submissions (last 5 with review feedback snippet)
  const recentSubmissions: RecentSubmissionItem[] = userSubs
    .slice(0, 5)
    .map((s) => {
      // reviews ordered by created_at? not guaranteed; pick latest by created_at
      const latestReview =
        s.reviews.length === 0
          ? null
          : s.reviews.slice().sort((x, y) => {
              const tx = new Date(x.created_at).getTime();
              const ty = new Date(y.created_at).getTime();
              return ty - tx;
            })[0] ?? null;
      return {
        id: s.id,
        status: s.status,
        submitted_at: s.submitted_at,
        is_late: s.is_late,
        assignment_id: s.assignment_id,
        assignment_title: s.assignments?.title ?? "Untitled assignment",
        review_feedback: latestReview?.feedback ?? null,
        review_status: latestReview?.review_status ?? null,
      };
    });

  // latest review feedback across all of user's submissions
  let latestReviewFeedback: LatestReviewItem | null = null;
  let latestReviewAt = -1;
  for (const s of userSubs) {
    for (const r of s.reviews) {
      const t = new Date(r.created_at).getTime();
      if (t > latestReviewAt) {
        latestReviewAt = t;
        latestReviewFeedback = {
          reviewId: r.id,
          reviewStatus: r.review_status,
          score: r.score,
          feedback: r.feedback,
          createdAt: r.created_at,
          submissionId: s.id,
          assignmentTitle: s.assignments?.title ?? "Untitled assignment",
        };
      }
    }
  }

  // ── blockers ──
  const activeBlockers: ActiveBlockerItem[] = (
    (blockersRes.data ?? []) as Array<{
      id: string;
      title: string;
      priority: BlockerPriority;
      status: BlockerStatus;
      created_at: string;
    }>
  ).map((b) => ({
    id: b.id,
    title: b.title,
    priority: b.priority,
    status: b.status,
    created_at: b.created_at,
  }));

  // ── announcements ──
  const recentAnnouncementsRaw =
    (announcementsRes.data ?? []) as unknown as RawAnnouncementWithAuthor[];
  const recentAnnouncements: RecentAnnouncementItem[] =
    recentAnnouncementsRaw.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      pinned: a.pinned,
      published_at: a.published_at,
      author_name: a.profiles?.full_name ?? "Team",
    }));

  // ── notifications ──
  const unreadNotifications = notifRes.count ?? 0;

  // ── weekly hours (sum across all reports + last 6 for sparkline) ──
  const weeklyReportsRaw =
    (weeklyReportsRes.data ?? []) as unknown as RawWeeklyReportWithWeek[];
  const weeklyHours = weeklyReportsRaw.reduce(
    (sum, r) => sum + (Number.isFinite(r.hours_spent) ? r.hours_spent : 0),
    0,
  );
  const weeklyHoursByReport: WeeklyHoursPoint[] = weeklyReportsRaw
    .slice(0, 6)
    .map((r) => ({
      weekId: r.week_id,
      weekTitle: r.weeks?.title ?? "Week",
      weekNumber: r.weeks?.week_number ?? null,
      hours: r.hours_spent,
      submittedAt: r.submitted_at,
    }))
    .reverse(); // chronological left-to-right

  return {
    currentPhase,
    currentWeek,
    pendingAssignments,
    upcomingDeadlines,
    completedAssignmentsCount,
    recentSubmissions,
    activeBlockers,
    recentAnnouncements,
    unreadNotifications,
    roadmapProgress,
    phaseProgress,
    weeklyHours,
    weeklyHoursByReport,
    latestReviewFeedback,
  };
}

function toPendingItem(
  a: RawAssignmentWithWeekAndRecipients,
): PendingAssignmentItem {
  return {
    id: a.id,
    title: a.title,
    deadline: a.deadline,
    assignment_type: a.assignment_type,
    difficulty: a.difficulty,
    week_id: a.week_id,
    week_title: a.weeks?.title ?? null,
    week_number: a.weeks?.week_number ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getIndividualProgress
// ─────────────────────────────────────────────────────────────────────────────

export async function getIndividualProgress(
  userId: string,
  teamId: string,
): Promise<IndividualProgress> {
  const supabase = await createSupabaseServerClient();

  const [topicsRes, progressRes, subsRes, assignmentsRes, reportsRes] =
    await Promise.all([
      supabase
        .from("topics")
        .select("id")
        .eq("team_id", teamId)
        .eq("publication_status", "published"),
      supabase
        .from("topic_progress")
        .select("topic_id, status")
        .eq("user_id", userId),
      supabase
        .from("submissions")
        .select("id, status")
        .eq("user_id", userId),
      supabase
        .from("assignments")
        .select(
          "id, publication_status, assignment_recipients(user_id)",
        )
        .eq("team_id", teamId)
        .eq("publication_status", "published"),
      supabase
        .from("weekly_reports")
        .select("hours_spent")
        .eq("user_id", userId),
    ]);

  requireSuccessfulReads([
    topicsRes,
    progressRes,
    subsRes,
    assignmentsRes,
    reportsRes,
  ]);

  const totalTopics = (topicsRes.data ?? []).length;
  const progressRows = (progressRes.data ?? []) as Array<{
    topic_id: string;
    status: TopicProgress["status"];
  }>;
  const completedTopics = progressRows.filter(
    (p) => p.status === "completed",
  ).length;

  const subs = (subsRes.data ?? []) as Array<{ id: string; status: SubmissionStatus }>;
  const approvedSubmissions = subs.filter((s) => s.status === "approved").length;
  const totalSubmissions = subs.length;

  // total assigned to this user (published + team-wide OR explicitly recipient)
  const assignmentsRaw = (assignmentsRes.data ?? []) as Array<{
    id: string;
    assignment_recipients: Array<{ user_id: string }>;
  }>;
  const totalAssigned = assignmentsRaw.filter((a) => {
    if (a.assignment_recipients.length === 0) return true;
    return a.assignment_recipients.some((r) => r.user_id === userId);
  }).length;

  // completedAssignments here = approved submissions (matches FR-P spec)
  const completedAssignments = approvedSubmissions;

  const reports = (reportsRes.data ?? []) as Array<{
    hours_spent: number;
  }>;
  const reportedHoursSum = reports.reduce(
    (sum, r) => sum + (Number.isFinite(r.hours_spent) ? r.hours_spent : 0),
    0,
  );

  return {
    completedTopics,
    totalTopics,
    topicsRatio: safeRatio(completedTopics, totalTopics),
    completedAssignments,
    totalAssigned,
    assignmentsRatio: safeRatio(completedAssignments, totalAssigned),
    approvedSubmissions,
    totalSubmissions,
    reportedHoursSum,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getTeamProgress — average of individual roadmap progress across active members
// ─────────────────────────────────────────────────────────────────────────────

export async function getTeamProgress(teamId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const [membersRes, topicsRes, progressRes] = await Promise.all([
    supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("membership_status", "active"),
    supabase
      .from("topics")
      .select("id")
      .eq("team_id", teamId)
      .eq("publication_status", "published"),
    // leaders/admins can read all team topic_progress via RLS
    supabase
      .from("topic_progress")
      .select("user_id, status, topics!inner(team_id)")
      .eq("topics.team_id", teamId)
      .eq("status", "completed"),
  ]);

  requireSuccessfulReads([membersRes, topicsRes, progressRes]);

  const members = (membersRes.data ?? []) as Array<{ user_id: string }>;
  const totalTopics = (topicsRes.data ?? []).length;
  if (members.length === 0 || totalTopics === 0) return 0;

  const progressRows = (progressRes.data ?? []) as Array<{
    user_id: string;
    status: TopicProgress["status"];
  }>;
  const completedByUser = new Map<string, number>();
  for (const p of progressRows) {
    completedByUser.set(p.user_id, (completedByUser.get(p.user_id) ?? 0) + 1);
  }

  let ratioSum = 0;
  for (const m of members) {
    const completed = completedByUser.get(m.user_id) ?? 0;
    ratioSum += safeRatio(completed, totalTopics);
  }
  return ratioSum / members.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// getAdminDashboardData
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminDashboardData(
  teamId: string,
): Promise<AdminDashboardData> {
  const supabase = await createSupabaseServerClient();

  const [
    membersRes,
    settingsRes,
    currentWeekRes,
    assignmentsCountRes,
    submissionsRes,
    blockersRes,
    topicsRes,
    progressRes,
    reportsRes,
    activityRes,
    recentSubsRes,
  ] = await Promise.all([
    supabase
      .from("team_members")
      .select(
        "id, user_id, role, membership_status, profiles(id, full_name)",
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: true }),
    supabase
      .from("team_settings")
      .select("current_week_id")
      .eq("team_id", teamId)
      .maybeSingle(),
    supabase
      .from("weeks")
      .select("id, title, week_number")
      .eq("team_id", teamId)
      .eq("status", "published")
      .order("week_number", { ascending: true }),
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId),
    // all team submissions — leader/admin RLS allows this
    supabase
      .from("submissions")
      .select("id, status, user_id, updated_at, assignments(id, title)")
      .eq("team_id", teamId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("blockers")
      .select("id, title, priority, status, created_at")
      .eq("team_id", teamId)
      .in("status", ["open", "being_addressed"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("topics")
      .select("id")
      .eq("team_id", teamId)
      .eq("publication_status", "published"),
    supabase
      .from("topic_progress")
      .select("user_id, status, updated_at, topics!inner(team_id)")
      .eq("topics.team_id", teamId),
    supabase
      .from("weekly_reports")
      .select("id, user_id, week_id, submitted_at")
      .eq("team_id", teamId),
    // Privacy-preserving audit events, readable by team leaders/admins through RLS.
    supabase
      .from("activity_logs")
      .select("id, action, entity_type, entity_id, user_id, metadata, created_at, profiles(full_name)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(20),
    // recent submissions across the team (separate, with assignment meta) for activity feed
    supabase
      .from("submissions")
      .select(
        "id, status, user_id, updated_at, is_late, assignments(id, title), profiles(full_name)",
      )
      .eq("team_id", teamId)
      .in("status", ["submitted", "under_review", "approved"])
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  requireSuccessfulReads([
    membersRes,
    settingsRes,
    currentWeekRes,
    assignmentsCountRes,
    submissionsRes,
    blockersRes,
    topicsRes,
    progressRes,
    reportsRes,
    activityRes,
    recentSubsRes,
  ]);

  // ── members ──
  const members = (membersRes.data ?? []) as unknown as RawMemberWithProfile[];
  const totalMembers = members.length;
  const activeMembers = members.filter(
    (m) => m.membership_status === "active",
  );
  const pendingMembers = members.filter(
    (m) =>
      m.membership_status === "pending_invite" ||
      m.membership_status === "pending_approval",
  ).length;

  // ── current week ──
  const currentWeekId =
    (settingsRes.data as { current_week_id: string | null } | null)
      ?.current_week_id ?? null;
  const weeks = (currentWeekRes.data ?? []) as Array<{
    id: string;
    title: string;
    week_number: number;
  }>;
  const currentWeekRow = currentWeekId
    ? (weeks.find((w) => w.id === currentWeekId) ?? null)
    : null;
  const currentWeek = currentWeekRow
    ? {
        id: currentWeekRow.id,
        title: currentWeekRow.title,
        week_number: currentWeekRow.week_number,
      }
    : null;

  // ── assignments + submissions counts ──
  const totalAssignments = assignmentsCountRes.count ?? 0;
  const allSubs = (submissionsRes.data ?? []) as unknown as RawSubmissionForActivity[];
  const pendingSubmissions = allSubs.filter(
    (s) => s.status === "submitted" || s.status === "under_review",
  ).length;
  const approvedSubmissionsCount = allSubs.filter(
    (s) => s.status === "approved",
  ).length;

  // ── blockers ──
  const openBlockers: ActiveBlockerItem[] = (
    (blockersRes.data ?? []) as Array<{
      id: string;
      title: string;
      priority: BlockerPriority;
      status: BlockerStatus;
      created_at: string;
    }>
  ).map((b) => ({
    id: b.id,
    title: b.title,
    priority: b.priority,
    status: b.status,
    created_at: b.created_at,
  }));

  // ── member progress list + team progress ──
  const totalTopics = (topicsRes.data ?? []).length;
  const progressRows = (progressRes.data ?? []) as Array<{
    user_id: string;
    status: TopicProgress["status"];
    updated_at: string;
  }>;
  const reportsRows = (reportsRes.data ?? []) as Array<{
    id: string;
    user_id: string;
    week_id: string;
    submitted_at: string;
  }>;

  // per-member aggregation
  const completedTopicsByUser = new Map<string, number>();
  const lastProgressActivityByUser = new Map<string, string>();
  for (const p of progressRows) {
    if (p.status === "completed") {
      completedTopicsByUser.set(
        p.user_id,
        (completedTopicsByUser.get(p.user_id) ?? 0) + 1,
      );
    }
    const prev = lastProgressActivityByUser.get(p.user_id);
    if (!prev || new Date(p.updated_at).getTime() > new Date(prev).getTime()) {
      lastProgressActivityByUser.set(p.user_id, p.updated_at);
    }
  }

  const approvedByUser = new Map<string, number>();
  const lastSubActivityByUser = new Map<string, string>();
  for (const s of allSubs) {
    if (s.status === "approved") {
      approvedByUser.set(s.user_id, (approvedByUser.get(s.user_id) ?? 0) + 1);
    }
    const prev = lastSubActivityByUser.get(s.user_id);
    if (
      !prev ||
      new Date(s.updated_at).getTime() > new Date(prev).getTime()
    ) {
      lastSubActivityByUser.set(s.user_id, s.updated_at);
    }
  }

  const lastReportActivityByUser = new Map<string, string>();
  for (const r of reportsRows) {
    const prev = lastReportActivityByUser.get(r.user_id);
    if (
      !prev ||
      new Date(r.submitted_at).getTime() > new Date(prev).getTime()
    ) {
      lastReportActivityByUser.set(r.user_id, r.submitted_at);
    }
  }

  const memberProgressList: MemberProgressRow[] = activeMembers.map((m) => {
    const topicsCompleted = completedTopicsByUser.get(m.user_id) ?? 0;
    const assignmentsApproved = approvedByUser.get(m.user_id) ?? 0;
    const candidate = [
      lastProgressActivityByUser.get(m.user_id) ?? null,
      lastSubActivityByUser.get(m.user_id) ?? null,
      lastReportActivityByUser.get(m.user_id) ?? null,
    ]
      .filter((v): v is string => v !== null)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const lastActivity = candidate[0] ?? null;
    const roadmapRatio = safeRatio(topicsCompleted, totalTopics);
    return {
      userId: m.user_id,
      memberId: m.id,
      name: m.profiles?.full_name ?? "Member",
      role: m.role,
      topicsCompleted,
      assignmentsApproved,
      lastActivity,
      roadmapRatio,
    };
  });
  // sort: most recently active first
  memberProgressList.sort((a, b) => {
    const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
    return tb - ta;
  });

  const teamProgress =
    activeMembers.length === 0
      ? 0
      : memberProgressList.reduce((s, m) => s + m.roadmapRatio, 0) /
        activeMembers.length;

  // ── weekly report completion (this current week) ──
  const submittedThisWeek = currentWeekId
    ? reportsRows.filter((r) => r.week_id === currentWeekId).length
    : 0;
  const weeklyReportCompletion = {
    submitted: submittedThisWeek,
    totalActive: activeMembers.length,
    ratio: safeRatio(submittedThisWeek, activeMembers.length),
    currentWeekId,
  };

  // ── recent activity feed ──
  const activityRows = (activityRes.data ?? []) as unknown as Array<{
    id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata: {
      status?: string;
      membership_status?: string;
      publication_status?: string;
      review_status?: string;
    } | null;
    created_at: string;
    profiles: { full_name: string | null } | null;
  }>;
  const recentSubsRows =
    (recentSubsRes.data ?? []) as unknown as RawSubmissionForActivity[];

  const recentActivity: AdminActivityItem[] = activityRows.slice(0, 10).map((event) => ({
    id: event.id,
    title: activityLabel(event.action, event.metadata),
    body: event.profiles?.full_name ?? "A team member",
    createdAt: event.created_at,
    link: activityLink(event.entity_type, event.entity_id),
  }));

  // ── review queue: submissions awaiting review (status submitted/under_review) ──
  const reviewQueue: ReviewQueueItem[] = recentSubsRows
    .filter((s) => s.status === "submitted" || s.status === "under_review")
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      status: s.status,
      assignmentId: s.assignments?.id ?? "",
      assignmentTitle: s.assignments?.title ?? "Untitled assignment",
      userId: s.user_id,
      userName: s.profiles?.full_name ?? "Member",
      updatedAt: s.updated_at,
      isLate: s.is_late ?? false,
    }));

  return {
    totalMembers,
    activeMembers: activeMembers.length,
    pendingMembers,
    totalAssignments,
    pendingSubmissions,
    approvedSubmissionsCount,
    currentWeek,
    teamProgress,
    memberProgressList,
    openBlockers,
    recentActivity,
    reviewQueue,
    weeklyReportCompletion,
  };
}

function activityLabel(
  action: string,
  metadata: {
    status?: string;
    membership_status?: string;
    publication_status?: string;
    review_status?: string;
  } | null,
): string {
  const operation = action.split(".")[1] ?? "updated";
  const status = metadata?.status ?? metadata?.membership_status ?? metadata?.publication_status ?? metadata?.review_status;
  const labels: Record<string, string> = {
    "team_members.insert": status === "pending_approval" ? "Registration request received" : "Member added",
    "team_members.update": "Membership updated",
    "team_members.delete": "Membership removed",
    "assignments.insert": "Assignment created",
    "assignments.update": "Assignment updated",
    "assignments.delete": "Assignment removed",
    "submissions.insert": status === "submitted" ? "Assignment submitted" : "Submission created",
    "submissions.update": status ? `Submission ${status.replaceAll("_", " ")}` : "Submission updated",
    "submissions.delete": "Submission removed",
    "weekly_reports.insert": "Weekly report submitted",
    "weekly_reports.update": "Weekly report updated",
    "weekly_reports.delete": "Weekly report removed",
    "discussion_threads.insert": "Discussion started",
    "discussion_threads.update": "Discussion updated",
    "discussion_threads.delete": "Discussion removed",
    "discussion_posts.insert": "Discussion reply posted",
    "discussion_posts.update": "Discussion post updated",
    "blockers.insert": "Help request opened",
    "blockers.update": status ? `Help request ${status.replaceAll("_", " ")}` : "Help request updated",
    "blockers.delete": "Help request removed",
    "blocker_comments.insert": "Blocker response posted",
    "blocker_comments.update": "Blocker response updated",
    "announcements.insert": "Announcement created",
    "announcements.update": "Announcement updated",
    "announcements.delete": "Announcement removed",
    "reviews.insert": "Submission review added",
    "reviews.update": status ? `Review ${status.replaceAll("_", " ")}` : "Submission review updated",
  };
  return labels[action] ?? `${action.split(".")[0]?.replaceAll("_", " ") ?? "Team"} ${operation}`;
}

function activityLink(entityType: string | null, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case "submissions": return `/submissions/${entityId}`;
    case "discussion_threads": return `/discussions/${entityId}`;
    case "blockers": return `/blockers/${entityId}`;
    case "announcements": return "/announcements";
    case "team_members": return "/admin/members";
    case "assignments": return "/admin/assignments";
    default: return null;
  }
}
