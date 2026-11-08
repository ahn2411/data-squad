import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import { blockerFilterSchema, type BlockerFilterValues } from "./schemas";
import type {
  Blocker,
  BlockerPriority,
  BlockerStatus,
  Profile,
  Topic,
  Assignment,
} from "@/types/database";

// Database row aliases (database.ts doesn't export these as standalone Row aliases).
type BlockerCommentRow = {
  id: string;
  blocker_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

/** Joined blocker shape: reporter profile + topic/assignment title. */
export type BlockerWithMeta = Blocker & {
  reporter: Pick<
    Profile,
    "id" | "email" | "full_name" | "username" | "avatar_url"
  > | null;
  topics: Pick<Topic, "id" | "title"> | null;
  assignments: Pick<Assignment, "id" | "title"> | null;
  helper: Pick<Profile, "id" | "full_name" | "email"> | null;
};

/** Blocker detail payload: blocker + comments (with author profiles) + topic/assignment. */
export type BlockerDetail = Blocker & {
  reporter: Pick<
    Profile,
    "id" | "email" | "full_name" | "username" | "avatar_url"
  > | null;
  topics: Pick<Topic, "id" | "title"> | null;
  assignments: Pick<Assignment, "id" | "title"> | null;
  helper: Pick<Profile, "id" | "full_name" | "email"> | null;
  comments: Array<BlockerCommentRow & {
    author: Pick<Profile, "id" | "email" | "full_name" | "avatar_url"> | null;
  }>;
};

/**
 * The current user's own blockers (RLS allows user_id = auth.uid()).
 * Ordered by created_at desc.
 */
export async function getMyBlockers(): Promise<BlockerWithMeta[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("blockers")
    .select(
      "*, reporter:profiles!blockers_user_id_fkey(id, email, full_name, username, avatar_url), topics:topics(id, title), assignments:assignments(id, title), helper:profiles!blockers_assigned_helper_fkey(id, full_name, email)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // RLS already filters to the caller's own rows, but defensively filter to be
  // certain we don't leak other teams' blockers through a join mishap.
  const rows = (data ?? []) as unknown as BlockerWithMeta[];
  return rows.filter((b) => b.user_id === ctx.userId);
}

/**
 * Leader/admin: all team blockers (RLS allows leaders/admins to see all).
 * Joined with reporter profile + topic/assignment title. Filterable by
 * status + priority + search.
 */
export async function getAllBlockers(
  filters?: BlockerFilterValues,
): Promise<BlockerWithMeta[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("blockers")
    .select(
      "*, reporter:profiles!blockers_user_id_fkey(id, email, full_name, username, avatar_url), topics:topics(id, title), assignments:assignments(id, title), helper:profiles!blockers_assigned_helper_fkey(id, full_name, email)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  let rows = (data ?? []) as unknown as BlockerWithMeta[];

  const parsed = blockerFilterSchema.safeParse(filters ?? {});
  if (parsed.success) {
    const f = parsed.data;
    if (f.status !== "all") {
      rows = rows.filter((b) => b.status === (f.status as BlockerStatus));
    }
    if (f.priority !== "all") {
      rows = rows.filter((b) => b.priority === (f.priority as BlockerPriority));
    }
    if (f.search) {
      const q = f.search.toLowerCase();
      rows = rows.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.description ?? "").toLowerCase().includes(q) ||
          (b.reporter?.email ?? "").toLowerCase().includes(q) ||
          (b.reporter?.full_name ?? "").toLowerCase().includes(q),
      );
    }
  }
  return rows;
}

/**
 * Blocker detail: full blocker + comments (with author profiles) + topic/assignment title.
 * RLS: owner OR leader/admin sees it.
 */
export async function getBlockerDetail(id: string): Promise<BlockerDetail | null> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("blockers")
    .select(
      "*, reporter:profiles!blockers_user_id_fkey(id, email, full_name, username, avatar_url), topics:topics(id, title), assignments:assignments(id, title), helper:profiles!blockers_assigned_helper_fkey(id, full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const blocker = data as unknown as BlockerDetail;

  // Fetch comments separately (with author profiles). RLS on blocker_comments
  // allows reading when the caller can see the blocker.
  const { data: comments } = await supabase
    .from("blocker_comments")
    .select(
      "*, author:profiles!blocker_comments_author_id_fkey(id, email, full_name, avatar_url)",
    )
    .eq("blocker_id", id)
    .order("created_at", { ascending: true });

  blocker.comments = (comments ?? []) as BlockerDetail["comments"];

  return blocker;
}

/**
 * Helper for the status-update form: list the team's active members so a
 * leader/admin can pick an assignee. Returns {id, name} pairs.
 */
export async function getActiveMembersForAssignment(): Promise<
  Array<{ id: string; name: string; email: string }>
> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("team_members")
    .select(
      "user_id, profiles(id, email, full_name, username, avatar_url)",
    )
    .eq("team_id", ctx.membership.team_id)
    .eq("membership_status", "active")
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as unknown as Array<{
    user_id: string;
    profiles: {
      id: string;
      email: string;
      full_name: string | null;
      username: string | null;
      avatar_url: string | null;
    } | null;
  }>;

  return rows
    .filter((r) => r.profiles)
    .map((r) => ({
      id: r.profiles!.id,
      email: r.profiles!.email,
      name: r.profiles!.full_name ?? r.profiles!.email,
    }));
}
