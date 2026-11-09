import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import type {
  DiscussionThread,
  DiscussionPost,
  Profile,
} from "@/types/database";

/**
 * Discussions server-side queries.
 *
 * RLS — discussion_threads: any active member can read/create threads in
 * their team; the author or a leader/admin can update (pin/lock) or delete.
 * discussion_posts: active members read non-deleted posts + create; the author
 * edits own; author or leader/admin soft-deletes (deleted_at = now).
 */

export type ProfileLite = Pick<
  Profile,
  "id" | "email" | "full_name" | "username" | "avatar_url"
>;

export type ThreadWithAuthor = DiscussionThread & {
  author: ProfileLite | null;
  post_count: number;
  last_activity: string | null;
};

export type PostWithAuthor = DiscussionPost & {
  author: ProfileLite | null;
};

export type ThreadDetail = DiscussionThread & {
  author: ProfileLite | null;
  posts: PostWithAuthor[];
};

interface GetThreadsFilters {
  category?: string;
  search?: string;
  page?: number;
}

export interface ThreadPageResult {
  threads: ThreadWithAuthor[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export const DISCUSSION_PAGE_SIZE = 20;

/**
 * List threads for the caller's team, joined with author profile + post count
 * + last activity timestamp. Pinned threads surface first, then created_at desc.
 *
 * Post counts + last-activity are computed in a second query (non-deleted
 * posts for the matching thread_ids) to avoid relying on nested-count
 * behavior that differs across Supabase versions.
 */
export async function getThreads(
  filters?: GetThreadsFilters,
): Promise<ThreadPageResult> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { threads: [], page: 1, pageSize: DISCUSSION_PAGE_SIZE, totalCount: 0, totalPages: 1 };
  }

  const supabase = await createSupabaseServerClient();
  const pageSize = DISCUSSION_PAGE_SIZE;
  const requestedPage = filters?.page;
  let page = typeof requestedPage === "number" &&
    Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 100_000)
    : 1;

  const buildQuery = () => {
    let query = supabase
      .from("discussion_threads")
      .select(
        "*, author:profiles!discussion_threads_created_by_fkey(id, full_name, username, avatar_url)",
        { count: "exact" },
      )
      .eq("team_id", ctx.membership.team_id);

    if (filters?.category && filters.category !== "all") {
      query = query.eq("category", filters.category);
    }
    if (filters?.search?.trim()) {
      query = query.ilike("title", `%${filters.search.trim().slice(0, 100)}%`);
    }

    // Pinned first (nulls last), then newest, with a stable tie-breaker.
    return query
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
  };

  let result = await buildQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) throw new Error("Could not load discussions.");

  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (page > totalPages) {
    page = totalPages;
    result = await buildQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) throw new Error("Could not load discussions.");
  }

  const threads = result.data;
  if (!threads) {
    return { threads: [], page, pageSize, totalCount, totalPages };
  }

  const threadIds = threads.map((t) => t.id as string);
  if (threadIds.length === 0) {
    return { threads: [], page, pageSize, totalCount, totalPages };
  }

  // Fetch non-deleted posts for these threads, newest first — so the first
  // row per thread_id is the latest activity.
  const { data: posts, error: postsError } = await supabase
    .from("discussion_posts")
    .select("thread_id, created_at")
    .in("thread_id", threadIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (postsError) throw new Error("Could not load discussion activity.");

  const countMap = new Map<string, number>();
  const lastActivityMap = new Map<string, string>();
  for (const p of posts ?? []) {
    const tid = p.thread_id as string;
    countMap.set(tid, (countMap.get(tid) ?? 0) + 1);
    if (!lastActivityMap.has(tid)) {
      lastActivityMap.set(tid, p.created_at as string);
    }
  }

  const pageThreads = threads.map((t) => {
    const tid = t.id as string;
    return {
      ...(t as unknown as DiscussionThread),
      author: (t as unknown as { author: ProfileLite | null }).author,
      post_count: countMap.get(tid) ?? 0,
      last_activity: lastActivityMap.get(tid) ?? null,
    } as ThreadWithAuthor;
  });

  return { threads: pageThreads, page, pageSize, totalCount, totalPages };
}

/**
 * A single thread with its non-deleted posts (and author profiles). Posts are
 * ordered by created_at ascending; the client component builds the parent →
 * child structure (one level of replies) from parent_post_id.
 */
export async function getThreadDetail(
  id: string,
): Promise<ThreadDetail | null> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("discussion_threads")
    .select(
      "*, author:profiles!discussion_threads_created_by_fkey(id, full_name, username, avatar_url), posts:discussion_posts(*, author:profiles!discussion_posts_author_id_fkey(id, full_name, username, avatar_url))",
    )
    .eq("id", id)
    .eq("team_id", ctx.membership.team_id)
    .maybeSingle();

  if (error) throw new Error("Could not load this discussion.");
  if (!data) return null;

  const thread = data as unknown as ThreadDetail;
  // Filter out soft-deleted posts (RLS may still surface them to the author
  // or a leader/admin; the thread view should never show them).
  thread.posts = (thread.posts ?? [])
    .filter((p) => p.deleted_at === null)
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return thread;
}
