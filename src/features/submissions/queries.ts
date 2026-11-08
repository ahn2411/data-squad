import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import type {
  Submission,
  Review,
  Assignment,
  Profile,
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
  profiles: Pick<Profile, "id" | "full_name" | "email" | "username"> | null;
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
  profiles: Pick<Profile, "id" | "full_name" | "email"> | null;
};

/** All submissions for the current user, with assignment join. */
export async function getMySubmissions(): Promise<MySubmissionItem[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "*, assignments:assignments(id, title, deadline, assignment_type, difficulty, max_score)",
    )
    .eq("user_id", ctx.userId)
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return data as unknown as MySubmissionItem[];
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
      "*, assignments:assignments(*), profiles:profiles!submissions_user_id_fkey(id, full_name, email, username), submission_revisions(*), submission_files(*), reviews(*, reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, email))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

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
      "*, assignments:assignments(id, title, deadline, assignment_type, difficulty, max_score), profiles:profiles!submissions_user_id_fkey(id, full_name, email)",
    )
    .in("status", ["submitted", "under_review"])
    .neq("user_id", ctx.userId)
    .order("submitted_at", { ascending: true });

  if (error || !data) return [];
  return data as unknown as ReviewQueueItem[];
}
