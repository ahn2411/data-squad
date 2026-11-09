import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import { assignmentFilterSchema, type AssignmentFilterValues } from "./schemas";
import type {
  Assignment,
  AssignmentWithMeta,
  Submission,
} from "@/types/database";
import type {
  SubmissionRevisionRow,
  SubmissionFileRow,
} from "@/features/submissions/types";
import type { Review } from "@/types/database";
import type { Profile } from "@/types/database";
import type { Database } from "@/types/database";

type AssignmentFile = Database["public"]["Tables"]["assignment_files"]["Row"];

/** Lightweight submission state attached to each assignment row. */
export type AssignmentWithMySubmission = AssignmentWithMeta & {
  my_submission?: Pick<
    Submission,
    "id" | "status" | "submitted_at" | "is_late"
  > | null;
  is_overdue: boolean;
};

export const ASSIGNMENT_PAGE_SIZE = 20;

export interface AssignmentPage {
  assignments: AssignmentWithMySubmission[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Detail page payload: assignment + joins + my submission + revisions + reviews. */
export type AssignmentDetail = AssignmentWithMeta & {
  topic?: { id: string; title: string } | null;
  assignment_files: AssignmentFile[];
  my_submission?: (Submission & {
    submission_revisions: SubmissionRevisionRow[];
    submission_files: SubmissionFileRow[];
    reviews: Array<Review & { reviewer: Pick<Profile, "id" | "full_name" | "email"> | null }>;
  }) | null;
};

/** Admin list payload. */
export type AdminAssignmentListItem = Assignment & {
  recipient_count: number;
  submission_count: number;
  phases?: { id: string; title: string; phase_number: number } | null;
  weeks?: { id: string; title: string; week_number: number } | null;
};

export interface AdminAssignmentPage {
  assignments: AdminAssignmentListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Returns assignments the current user can see (RLS does the heavy lifting:
 * admins/leaders see all, members see published + assigned-or-team-wide).
 * Left-joins the user's own submission status per assignment.
 */
export async function getAssignmentsForUser(
  filters?: AssignmentFilterValues,
  requestedPage = 1,
): Promise<AssignmentPage> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { assignments: [], totalCount: 0, page: 1, pageSize: ASSIGNMENT_PAGE_SIZE };
  }

  const supabase = await createSupabaseServerClient();
  const userId = ctx.userId;
  const nowIso = new Date().toISOString();

  const parsed = assignmentFilterSchema.safeParse(filters ?? {});
  const filter = parsed.success ? parsed.data : assignmentFilterSchema.parse({});
  // Discard PostgREST filter syntax and wildcard characters so the query text
  // is treated as literal search input, not as a filter expression.
  const rawSearch = filter.search.slice(0, 120);
  const searchText = rawSearch.replace(/[%,_*()!\\]/g, "").trim();
  let assignmentQuery = supabase
    .from("assignments")
    .select(
      "*, phases:phases(id, title, phase_number), weeks:weeks(id, title, week_number)",
    )
    .order("deadline", { ascending: true, nullsFirst: false });
  if (searchText && searchText === rawSearch.trim()) {
    assignmentQuery = assignmentQuery.or(
      `title.ilike.%${searchText}%,description.ilike.%${searchText}%`,
    );
  }
  const { data, error } = await assignmentQuery;

  if (error) {
    throw new Error("Could not load assignments.");
  }

  // Fetch the user's submissions for these assignments in one go.
  const assignmentIds = (data ?? []).map((a) => a.id);
  let mySubs: Pick<Submission, "assignment_id" | "id" | "status" | "submitted_at" | "is_late">[] = [];
  if (assignmentIds.length > 0) {
    const { data: subs, error: submissionsError } = await supabase
      .from("submissions")
      .select("assignment_id, id, status, submitted_at, is_late")
      .eq("user_id", userId)
      .in("assignment_id", assignmentIds);
    if (submissionsError) {
      throw new Error("Could not load assignment submission statuses.");
    }
    mySubs = subs ?? [];
  }

  const subsByAssignment = new Map<string, (typeof mySubs)[number]>();
  for (const s of mySubs) {
    subsByAssignment.set(s.assignment_id, s);
  }

  const rows = (data ?? []) as unknown as AssignmentWithMeta[];
  const merged: AssignmentWithMySubmission[] = rows.map((row) => {
    const sub = subsByAssignment.get(row.id);
    const approved = sub?.status === "approved";
    const isOverdue =
      !approved &&
      row.deadline !== null &&
      new Date(row.deadline) < new Date(nowIso);
    return {
      ...row,
      my_submission: sub
        ? {
            id: sub.id,
            status: sub.status,
            submitted_at: sub.submitted_at,
            is_late: sub.is_late,
          }
        : null,
      is_overdue: isOverdue,
    };
  });

  // Submission state is user-specific, so apply that filter after the RLS-
  // scoped assignment rows have been joined with this user's submissions.
  const f = filter;

  let filtered = merged;
  if (f.search) {
    const q = f.search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q),
    );
  }

  switch (f.status) {
    case "pending":
      filtered = filtered.filter(
        (a) =>
          !a.my_submission ||
          a.my_submission.status === "not_started" ||
          a.my_submission.status === "in_progress" ||
          a.my_submission.status === "revision_requested",
      );
      break;
    case "submitted":
      filtered = filtered.filter(
        (a) =>
          a.my_submission?.status === "submitted" ||
          a.my_submission?.status === "under_review",
      );
      break;
    case "approved":
      filtered = filtered.filter((a) => a.my_submission?.status === "approved");
      break;
    case "overdue":
      filtered = filtered.filter((a) => a.is_overdue);
      break;
    case "all":
    default:
      break;
  }

  const totalCount = filtered.length;
  const lastPage = Math.max(1, Math.ceil(totalCount / ASSIGNMENT_PAGE_SIZE));
  const safePage = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, lastPage)
    : 1;
  const start = (safePage - 1) * ASSIGNMENT_PAGE_SIZE;
  return {
    assignments: filtered.slice(start, start + ASSIGNMENT_PAGE_SIZE),
    totalCount,
    page: safePage,
    pageSize: ASSIGNMENT_PAGE_SIZE,
  };
}

/**
 * Assignment detail for a member: full content + the user's submission
 * (with revisions, files, and reviews).
 */
export async function getAssignmentDetail(
  id: string,
): Promise<AssignmentDetail | null> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return null;

  const supabase = await createSupabaseServerClient();
  const userId = ctx.userId;

  const { data, error } = await supabase
    .from("assignments")
    .select(
      "*, phases:phases(id, title, phase_number), weeks:weeks(id, title, week_number), topic:topics(id, title)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Could not load this assignment.");
  if (!data) return null;

  const base = data as unknown as AssignmentDetail;

  // My submission + revisions + files + reviews (with reviewer profile).
  const { data: sub, error: submissionError } = await supabase
    .from("submissions")
    .select(
      "*, submission_revisions(*), submission_files(*), reviews(*, reviewer:profiles!reviews_reviewer_id_fkey(id, full_name))",
    )
    .eq("assignment_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (submissionError) {
    throw new Error("Could not load your assignment submission.");
  }

  const { data: files, error: filesError } = await supabase
    .from("assignment_files")
    .select("*")
    .eq("assignment_id", id)
    .order("created_at", { ascending: true });
  if (filesError) {
    throw new Error("Could not load assignment attachments.");
  }

  base.my_submission = (sub as AssignmentDetail["my_submission"]) ?? null;
  base.assignment_files = (files ?? []) as AssignmentFile[];

  return base;
}

/**
 * Admin/leader: list all team assignments with recipient + submission counts.
 */
export async function getAdminAssignments(
  filters?: { status?: "all" | "draft" | "published" | "archived"; search?: string },
  requestedPage = 1,
): Promise<AdminAssignmentPage> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active" || (ctx.membership.role !== "admin" && ctx.membership.role !== "leader")) {
    return { assignments: [], totalCount: 0, page: 1, pageSize: 20 };
  }

  const supabase = await createSupabaseServerClient();
  const allowedStatuses = ["all", "draft", "published", "archived"] as const;
  const status = filters?.status && allowedStatuses.includes(filters.status)
    ? filters.status
    : "all";
  const search = (filters?.search ?? "").trim().slice(0, 120);
  const safeSearch = search.replace(/[%,_*()!\\]/g, "").trim();
  const pageSize = 20;
  const lastRequestedPage = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 1_000_000)
    : 1;

  const buildQuery = () => {
    let query = supabase
    .from("assignments")
    .select(
      "*, phases:phases(id, title, phase_number), weeks:weeks(id, title, week_number)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
    if (status !== "all") query = query.eq("publication_status", status);
    if (safeSearch) {
      query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
    }
    return query;
  };

  const executePage = async (page: number) => buildQuery()
    .range((page - 1) * pageSize, page * pageSize - 1);

  const initial = await executePage(lastRequestedPage);
  if (initial.error) throw new Error("Could not load assignments.");
  const totalCount = initial.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(lastRequestedPage, lastPage);
  const { data, error } = page === lastRequestedPage
    ? initial
    : await executePage(page);

  if (error) throw new Error("Could not load assignments.");

  const assignmentRows = data ?? [];
  const assignmentIds = assignmentRows.map((a) => a.id);
  let recipientCounts = new Map<string, number>();
  let submissionCounts = new Map<string, number>();

  if (assignmentIds.length > 0) {
    const { data: recipients, error: recipientsError } = await supabase
      .from("assignment_recipients")
      .select("assignment_id")
      .in("assignment_id", assignmentIds);
    if (recipientsError) {
      throw new Error("Could not load assignment recipients.");
    }
    for (const r of recipients ?? []) {
      recipientCounts.set(
        r.assignment_id,
        (recipientCounts.get(r.assignment_id) ?? 0) + 1,
      );
    }

    const { data: subs, error: submissionsError } = await supabase
      .from("submissions")
      .select("assignment_id")
      .in("assignment_id", assignmentIds);
    if (submissionsError) {
      throw new Error("Could not load assignment submission counts.");
    }
    for (const s of subs ?? []) {
      submissionCounts.set(
        s.assignment_id,
        (submissionCounts.get(s.assignment_id) ?? 0) + 1,
      );
    }
  }

  const merged: AdminAssignmentListItem[] = assignmentRows.map((row) => {
    const r = row as unknown as Assignment;
    return {
      ...r,
      recipient_count: recipientCounts.get(r.id) ?? 0,
      submission_count: submissionCounts.get(r.id) ?? 0,
    };
  });

  return { assignments: merged, totalCount, page, pageSize };
}

/** Single assignment row (admin edit page). Includes current recipients. */
export async function getAdminAssignmentDetail(
  id: string,
): Promise<{
  assignment: Assignment;
  recipients: string[];
  files: AssignmentFile[];
} | null> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return null;
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Could not load this assignment.");
  if (!data) return null;

  const { data: recipientRows, error: recipientsError } = await supabase
    .from("assignment_recipients")
    .select("user_id")
    .eq("assignment_id", id);
  if (recipientsError) {
    throw new Error("Could not load assignment recipients.");
  }

  const { data: files, error: filesError } = await supabase
    .from("assignment_files")
    .select("*")
    .eq("assignment_id", id)
    .order("created_at", { ascending: true });
  if (filesError) {
    throw new Error("Could not load assignment attachments.");
  }

  return {
    assignment: data as unknown as Assignment,
    recipients: (recipientRows ?? []).map((r) => r.user_id),
    files: (files ?? []) as AssignmentFile[],
  };
}

/**
 * Overdue assignments: deadline in the past, no approved submission.
 * If userId is provided, scoped to that user; else team-wide (admin/leader).
 */
export async function getOverdueAssignments(
  userId?: string,
): Promise<Array<Assignment & { my_submission?: Pick<Submission, "status"> | null }>> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];

  const supabase = await createSupabaseServerClient();
  const targetUserId = userId ?? ctx.userId;
  const nowIso = new Date().toISOString();

  // Team admins can call with another user's id; members are constrained to self.
  const effectiveUserId =
    ctx.membership.role === "admin" || ctx.membership.role === "leader"
      ? targetUserId
      : ctx.userId;

  const { data: assignments } = await supabase
    .from("assignments")
    .select("*, phases:phases(id, title, phase_number), weeks:weeks(id, title, week_number)")
    .lt("deadline", nowIso)
    .order("deadline", { ascending: true });

  if (!assignments) return [];

  const ids = assignments.map((a) => a.id);
  if (ids.length === 0) return [];

  const { data: subs } = await supabase
    .from("submissions")
    .select("assignment_id, status")
    .eq("user_id", effectiveUserId)
    .in("assignment_id", ids);

  const subByAssignment = new Map<string, Submission["status"]>();
  for (const s of subs ?? []) {
    subByAssignment.set(s.assignment_id, s.status);
  }

  return assignments
    .filter((a) => subByAssignment.get(a.id) !== "approved")
    .map((a) => {
      const status = subByAssignment.get(a.id) ?? null;
      return {
        ...(a as unknown as Assignment),
        my_submission: status ? { status } : null,
      };
    });
}
