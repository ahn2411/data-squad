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

/** Lightweight submission state attached to each assignment row. */
export type AssignmentWithMySubmission = AssignmentWithMeta & {
  my_submission?: Pick<
    Submission,
    "id" | "status" | "submitted_at" | "is_late"
  > | null;
  is_overdue: boolean;
};

/** Detail page payload: assignment + joins + my submission + revisions + reviews. */
export type AssignmentDetail = AssignmentWithMeta & {
  topic?: { id: string; title: string } | null;
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

/**
 * Returns assignments the current user can see (RLS does the heavy lifting:
 * admins/leaders see all, members see published + assigned-or-team-wide).
 * Left-joins the user's own submission status per assignment.
 */
export async function getAssignmentsForUser(
  filters?: AssignmentFilterValues,
): Promise<AssignmentWithMySubmission[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];

  const supabase = await createSupabaseServerClient();
  const userId = ctx.userId;
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      "*, phases:phases(id, title, phase_number), weeks:weeks(id, title, week_number)",
    )
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) return [];

  // Fetch the user's submissions for these assignments in one go.
  const assignmentIds = (data ?? []).map((a) => a.id);
  let mySubs: Pick<Submission, "assignment_id" | "id" | "status" | "submitted_at" | "is_late">[] = [];
  if (assignmentIds.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("assignment_id, id, status, submitted_at, is_late")
      .eq("user_id", userId)
      .in("assignment_id", assignmentIds);
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

  // Apply filters
  const parsed = assignmentFilterSchema.safeParse(filters ?? {});
  if (!parsed.success) return merged;
  const f = parsed.data;

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

  return filtered;
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

  if (error || !data) return null;

  const base = data as unknown as AssignmentDetail;

  // My submission + revisions + files + reviews (with reviewer profile).
  const { data: sub } = await supabase
    .from("submissions")
    .select(
      "*, submission_revisions(*), submission_files(*), reviews(*, reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, email))",
    )
    .eq("assignment_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  base.my_submission = (sub as AssignmentDetail["my_submission"]) ?? null;

  return base;
}

/**
 * Admin/leader: list all team assignments with recipient + submission counts.
 */
export async function getAdminAssignments(
  filters?: { status?: "all" | "draft" | "published" | "archived"; search?: string },
): Promise<AdminAssignmentListItem[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      "*, phases:phases(id, title, phase_number), weeks:weeks(id, title, week_number)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const assignmentIds = data.map((a) => a.id);
  let recipientCounts = new Map<string, number>();
  let submissionCounts = new Map<string, number>();

  if (assignmentIds.length > 0) {
    const { data: recipients } = await supabase
      .from("assignment_recipients")
      .select("assignment_id")
      .in("assignment_id", assignmentIds);
    for (const r of recipients ?? []) {
      recipientCounts.set(
        r.assignment_id,
        (recipientCounts.get(r.assignment_id) ?? 0) + 1,
      );
    }

    const { data: subs } = await supabase
      .from("submissions")
      .select("assignment_id")
      .in("assignment_id", assignmentIds);
    for (const s of subs ?? []) {
      submissionCounts.set(
        s.assignment_id,
        (submissionCounts.get(s.assignment_id) ?? 0) + 1,
      );
    }
  }

  let merged: AdminAssignmentListItem[] = data.map((row) => {
    const r = row as unknown as Assignment;
    return {
      ...r,
      recipient_count: recipientCounts.get(r.id) ?? 0,
      submission_count: submissionCounts.get(r.id) ?? 0,
    };
  });

  if (filters?.status && filters.status !== "all") {
    merged = merged.filter((a) => a.publication_status === filters.status);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    merged = merged.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q),
    );
  }

  return merged;
}

/** Single assignment row (admin edit page). Includes current recipients. */
export async function getAdminAssignmentDetail(
  id: string,
): Promise<{
  assignment: Assignment;
  recipients: string[];
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

  if (error || !data) return null;

  const { data: recipientRows } = await supabase
    .from("assignment_recipients")
    .select("user_id")
    .eq("assignment_id", id);

  return {
    assignment: data as unknown as Assignment,
    recipients: (recipientRows ?? []).map((r) => r.user_id),
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
