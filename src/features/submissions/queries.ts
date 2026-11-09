import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import type {
  Submission,
  Review,
  Assignment,
  Profile,
  SubmissionStatus,
} from "@/types/database";
import type {
  SubmissionRevisionRow,
  SubmissionFileRow,
} from "./types";

export type MySubmissionItem = Submission & {
  assignments: Pick<
    Assignment,
    "id" | "title" | "deadline" | "assignment_type" | "difficulty" | "max_score"
  >;
};

export type SubmissionDetail = Submission & {
  assignments: Assignment;
  profiles: Pick<Profile, "id" | "full_name" | "username"> | null;
  submission_revisions: SubmissionRevisionRow[];
  submission_files: SubmissionFileRow[];
  reviews: Array<
    Review & {
      reviewer: Pick<Profile, "id" | "full_name" | "email"> | null;
    }
  >;
};

export type ReviewQueueItem = Submission & {
  assignments: Pick<
    Assignment,
    "id" | "title" | "deadline" | "assignment_type" | "difficulty" | "max_score"
  >;
  profiles: Pick<Profile, "id" | "full_name"> | null;
};

export const MY_SUBMISSIONS_PAGE_SIZE = 20;

export type MySubmissionsPage = {
  rows: MySubmissionItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** A stable, user-scoped page of the current user's submission history. */
export async function getMySubmissions(
  requestedPage = 1,
  filters: { query?: string; status?: SubmissionStatus } = {},
): Promise<MySubmissionsPage> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { rows: [], total: 0, page: 1, pageSize: MY_SUBMISSIONS_PAGE_SIZE, totalPages: 1 };
  }

  const supabase = await createSupabaseServerClient();
  const safeRequestedPage = Number.isSafeInteger(requestedPage)
    ? Math.max(1, requestedPage)
    : 1;
  const search = filters.query?.trim().slice(0, 100) ?? "";
  let countQuery = supabase
    .from("submissions")
    .select("id, assignments!inner(title)", { count: "exact", head: true })
    .eq("user_id", ctx.userId);
  if (search) countQuery = countQuery.ilike("assignments.title", `%${search}%`);
  if (filters.status) countQuery = countQuery.eq("status", filters.status);
  const { count, error: countError } = await countQuery;
  if (countError) {
    throw new Error("Could not count your submissions.");
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / MY_SUBMISSIONS_PAGE_SIZE));
  const page = Math.min(safeRequestedPage, totalPages);
  const columns = "*, assignments:assignments!inner(id, title, deadline, assignment_type, difficulty, max_score)";
  let resultQuery = supabase
    .from("submissions")
    .select(columns)
    .eq("user_id", ctx.userId)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range((page - 1) * MY_SUBMISSIONS_PAGE_SIZE, page * MY_SUBMISSIONS_PAGE_SIZE - 1);
  if (search) resultQuery = resultQuery.ilike("assignments.title", `%${search}%`);
  if (filters.status) resultQuery = resultQuery.eq("status", filters.status);
  const result = await resultQuery;
  if (result.error) {
    throw new Error("Could not load your submissions.");
  }
  return {
    rows: (result.data ?? []) as unknown as MySubmissionItem[],
    total,
    page,
    pageSize: MY_SUBMISSIONS_PAGE_SIZE,
    totalPages,
  };
}

/** Single submission detail (member sees own; leader/admin sees any team submission). */
export async function getSubmissionDetail(
  id: string,
): Promise<SubmissionDetail | null> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("submissions")
    .select(
      "*, assignments:assignments(*), profiles:profiles!submissions_user_id_fkey(id, full_name, username), submission_revisions(*), submission_files(*), reviews(*, reviewer:profiles!reviews_reviewer_id_fkey(id, full_name))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Could not load this submission.");
  if (!data) return null;

  // RLS already restricts to: own submission OR team leader/admin. If empty, return null.
  return data as unknown as SubmissionDetail;
}

/**
 * Review queue: submissions in {submitted, under_review} status across the
 * team (leader/admin only). Excludes submissions authored by the caller
 * (a reviewer cannot review their own work).
 */
export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader")
    return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "*, assignments:assignments(id, title, deadline, assignment_type, difficulty, max_score), profiles:profiles!submissions_user_id_fkey(id, full_name)",
    )
    .in("status", ["submitted", "under_review"])
    .neq("user_id", ctx.userId)
    .order("submitted_at", { ascending: true });

  if (error) {
    throw new Error("Could not load the review queue.");
  }
  return data as unknown as ReviewQueueItem[];
}
