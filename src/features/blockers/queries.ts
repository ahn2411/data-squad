import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import { blockerFilterSchema, type BlockerFilterValues } from "./schemas";
import type {
  Blocker,
  Profile,
  Topic,
  Assignment,
} from "@/types/database";
import type { Database } from "@/types/database";
type BlockerFile = Database["public"]["Tables"]["blocker_files"]["Row"];

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
    "id" | "full_name" | "username" | "avatar_url"
  > | null;
  topics: Pick<Topic, "id" | "title"> | null;
  assignments: Pick<Assignment, "id" | "title"> | null;
  helper: Pick<Profile, "id" | "full_name"> | null;
};

export const BLOCKER_PAGE_SIZE = 20;

export interface BlockerPage {
  blockers: BlockerWithMeta[];
  totalCount: number;
  page: number;
  pageSize: number;
  openCount: number;
}

/** Blocker detail payload: blocker + comments (with author profiles) + topic/assignment. */
export type BlockerDetail = Blocker & {
  reporter: Pick<
    Profile,
    "id" | "full_name" | "username" | "avatar_url"
  > | null;
  topics: Pick<Topic, "id" | "title"> | null;
  assignments: Pick<Assignment, "id" | "title"> | null;
  helper: Pick<Profile, "id" | "full_name"> | null;
  comments: Array<BlockerCommentRow & {
    author: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  }>;
  files: BlockerFile[];
};

/**
 * The current user's own blockers (RLS allows user_id = auth.uid()).
 * Ordered by created_at desc.
 */
export async function getMyBlockers(
  filters?: BlockerFilterValues,
  requestedPage = 1,
): Promise<BlockerPage> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { blockers: [], totalCount: 0, page: 1, pageSize: BLOCKER_PAGE_SIZE, openCount: 0 };
  }

  const supabase = await createSupabaseServerClient();
  const parsed = blockerFilterSchema.safeParse(filters ?? {});
  const filter = parsed.success ? parsed.data : blockerFilterSchema.parse({});
  const safePage = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 1_000_000)
    : 1;
  const safeSearch = filter.search.replace(/[%,_*()!\\]/g, "").trim();
  let query = supabase
    .from("blockers")
    .select(
      "*, reporter:profiles!blockers_user_id_fkey(id, full_name, username, avatar_url), topics:topics(id, title), assignments:assignments(id, title), helper:profiles!blockers_assigned_helper_fkey(id, full_name)",
      { count: "exact" },
    )
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });
  if (filter.status !== "all") query = query.eq("status", filter.status);
  if (filter.priority !== "all") query = query.eq("priority", filter.priority);
  if (safeSearch) {
    query = query.or(
      `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,error_messages.ilike.%${safeSearch}%`,
    );
  }
  const from = (safePage - 1) * BLOCKER_PAGE_SIZE;
  const initial = await query.range(from, from + BLOCKER_PAGE_SIZE - 1);

  if (initial.error) throw new Error("Could not load blockers.");
  const totalCount = initial.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(totalCount / BLOCKER_PAGE_SIZE));
  const page = Math.min(safePage, lastPage);
  let data = initial.data;
  if (page !== safePage) {
    const { data: lastPageData, error } = await query.range(
      (page - 1) * BLOCKER_PAGE_SIZE,
      page * BLOCKER_PAGE_SIZE - 1,
    );
    if (error) throw new Error("Could not load blockers.");
    data = lastPageData;
  }

  const rows = (data ?? []) as unknown as BlockerWithMeta[];
  return {
    blockers: rows.filter((blocker) => blocker.user_id === ctx.userId),
    totalCount,
    page,
    pageSize: BLOCKER_PAGE_SIZE,
    openCount: 0,
  };
}

/**
 * Leader/admin: all team blockers (RLS allows leaders/admins to see all).
 * Joined with reporter profile + topic/assignment title. Filterable by
 * status + priority + search.
 */
export async function getAllBlockers(
  filters?: BlockerFilterValues,
  requestedPage = 1,
): Promise<BlockerPage> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { blockers: [], totalCount: 0, page: 1, pageSize: BLOCKER_PAGE_SIZE, openCount: 0 };
  }
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return { blockers: [], totalCount: 0, page: 1, pageSize: BLOCKER_PAGE_SIZE, openCount: 0 };
  }

  const supabase = await createSupabaseServerClient();
  const parsed = blockerFilterSchema.safeParse(filters ?? {});
  const filter = parsed.success ? parsed.data : blockerFilterSchema.parse({});
  const safePage = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 1_000_000)
    : 1;
  const safeSearch = filter.search.replace(/[%,_*()!\\]/g, "").trim();
  const select = "*, reporter:profiles!blockers_user_id_fkey(id, full_name, username, avatar_url), topics:topics(id, title), assignments:assignments(id, title), helper:profiles!blockers_assigned_helper_fkey(id, full_name)";
  const buildQuery = () => {
    let query = supabase.from("blockers").select(select, { count: "exact" });
    if (filter.status !== "all") query = query.eq("status", filter.status);
    if (filter.priority !== "all") query = query.eq("priority", filter.priority);
    return query.order("created_at", { ascending: false });
  };
  const { count: openCount, error: openCountError } = await supabase
    .from("blockers")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "being_addressed"]);
  if (openCountError) throw new Error("Could not load blocker summary.");

  let rows: BlockerWithMeta[];
  let totalCount: number;
  let page = safePage;
  if (filter.search && !safeSearch) {
    rows = [];
    totalCount = 0;
    page = 1;
  } else if (safeSearch) {
    const baseQuery = buildQuery()
      .or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,error_messages.ilike.%${safeSearch}%`);
    const [baseResults, matchingProfiles] = await Promise.all([
      baseQuery,
      supabase.from("profiles").select("id")
        .ilike("full_name", `%${safeSearch}%`),
    ]);
    if (baseResults.error || matchingProfiles.error) {
      throw new Error("Could not search team blockers.");
    }
    const baseRows = (baseResults.data ?? []) as unknown as BlockerWithMeta[];
    const reporterIds = (matchingProfiles.data ?? []).map((profile) => profile.id);
    let reporterRows: BlockerWithMeta[] = [];
    if (reporterIds.length) {
      let reporterQuery = buildQuery().in("user_id", reporterIds);
      const { data, error } = await reporterQuery;
      if (error) throw new Error("Could not search team blockers.");
      reporterRows = (data ?? []) as unknown as BlockerWithMeta[];
    }
    const byId = new Map([...baseRows, ...reporterRows].map((row) => [row.id, row]));
    rows = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    totalCount = rows.length;
    const lastPage = Math.max(1, Math.ceil(totalCount / BLOCKER_PAGE_SIZE));
    page = Math.min(safePage, lastPage);
    rows = rows.slice((page - 1) * BLOCKER_PAGE_SIZE, page * BLOCKER_PAGE_SIZE);
  } else {
    const initial = await buildQuery()
      .range((safePage - 1) * BLOCKER_PAGE_SIZE, safePage * BLOCKER_PAGE_SIZE - 1);
    if (initial.error) throw new Error("Could not load team blockers.");
    totalCount = initial.count ?? 0;
    const lastPage = Math.max(1, Math.ceil(totalCount / BLOCKER_PAGE_SIZE));
    page = Math.min(safePage, lastPage);
    let data = initial.data;
    if (page !== safePage) {
      const { data: lastPageData, error } = await buildQuery()
        .range((page - 1) * BLOCKER_PAGE_SIZE, page * BLOCKER_PAGE_SIZE - 1);
      if (error) throw new Error("Could not load team blockers.");
      data = lastPageData;
    }
    rows = (data ?? []) as unknown as BlockerWithMeta[];
  }

  return { blockers: rows, totalCount, page, pageSize: BLOCKER_PAGE_SIZE, openCount: openCount ?? 0 };
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
      "*, reporter:profiles!blockers_user_id_fkey(id, full_name, username, avatar_url), topics:topics(id, title), assignments:assignments(id, title), helper:profiles!blockers_assigned_helper_fkey(id, full_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Could not load this blocker.");
  if (!data) return null;

  const blocker = data as unknown as BlockerDetail;

  // Fetch comments separately (with author profiles). RLS on blocker_comments
  // allows reading when the caller can see the blocker.
  const { data: comments, error: commentsError } = await supabase
    .from("blocker_comments")
    .select(
      "*, author:profiles!blocker_comments_author_id_fkey(id, full_name, avatar_url)",
    )
    .eq("blocker_id", id)
    .order("created_at", { ascending: true });
  if (commentsError) throw new Error("Could not load blocker comments.");

  blocker.comments = (comments ?? []) as BlockerDetail["comments"];

  const { data: files, error: filesError } = await supabase.from("blocker_files")
    .select("*").eq("blocker_id", id).order("created_at", { ascending: true });
  if (filesError) throw new Error("Could not load blocker attachments.");
  blocker.files = (files ?? []) as BlockerFile[];

  return blocker;
}

/**
 * Helper for the status-update form: list the team's active members so a
 * leader/admin can pick an assignee. Returns {id, name} pairs.
 */
export async function getActiveMembersForAssignment(): Promise<
  Array<{ id: string; name: string }>
> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("team_members")
    .select(
      "user_id, profiles(id, full_name, username, avatar_url)",
    )
    .eq("team_id", ctx.membership.team_id)
    .eq("membership_status", "active")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load squad members.");

  const rows = (data ?? []) as unknown as Array<{
    user_id: string;
    profiles: {
      id: string;
      full_name: string | null;
      username: string | null;
      avatar_url: string | null;
    } | null;
  }>;

  return rows
    .filter((r) => r.profiles)
    .map((r) => ({
      id: r.profiles!.id,
      name: r.profiles!.full_name ?? "Member",
    }));
}
