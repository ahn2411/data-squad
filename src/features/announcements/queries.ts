import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import type { Announcement, Profile } from "@/types/database";

/** Joined announcement shape: author profile. */
export type AnnouncementWithAuthor = Announcement & {
  author: Pick<
    Profile,
    "id" | "email" | "full_name" | "username" | "avatar_url"
  > | null;
};

export const ANNOUNCEMENT_PAGE_SIZE = 20;

export interface AnnouncementPage {
  announcements: AnnouncementWithAuthor[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export type AnnouncementStatusFilter = "all" | Announcement["status"];

/**
 * Member-visible announcements: published only (RLS enforces this).
 * Pinned first, then by published_at desc.
 */
export async function getAnnouncements({
  search = "",
  page = 1,
}: {
  search?: string;
  page?: number;
} = {}): Promise<AnnouncementPage> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { announcements: [], totalCount: 0, page: 1, pageSize: ANNOUNCEMENT_PAGE_SIZE };
  }

  const supabase = await createSupabaseServerClient();
  const queryText = search.trim().slice(0, 100).replace(/[%_]/g, "");
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  // Keep all filters server-side and apply RLS before returning a page.
  let filtered = supabase
    .from("announcements")
    .select(
      "*, author:profiles!announcements_author_id_fkey(id, full_name, username, avatar_url)",
      { count: "exact" },
    )
    .eq("status", "published");
  if (queryText) filtered = filtered.ilike("title", `%${queryText}%`);
  const from = (safePage - 1) * ANNOUNCEMENT_PAGE_SIZE;
  const { data, error, count } = await filtered
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, from + ANNOUNCEMENT_PAGE_SIZE - 1);

  if (error) throw new Error("Could not load announcements.");
  const totalCount = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(totalCount / ANNOUNCEMENT_PAGE_SIZE));
  if (safePage > lastPage) {
    return getAnnouncements({ search: queryText, page: lastPage });
  }
  return {
    announcements: (data ?? []) as unknown as AnnouncementWithAuthor[],
    totalCount,
    page: safePage,
    pageSize: ANNOUNCEMENT_PAGE_SIZE,
  };
}

/**
 * Admin/leader: all announcements (drafts + published + archived).
 * Ordered by created_at desc.
 */
export async function getAdminAnnouncements({
  search = "",
  status = "all",
  page = 1,
}: {
  search?: string;
  status?: AnnouncementStatusFilter;
  page?: number;
} = {}): Promise<AnnouncementPage> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return { announcements: [], totalCount: 0, page: 1, pageSize: ANNOUNCEMENT_PAGE_SIZE };
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return { announcements: [], totalCount: 0, page: 1, pageSize: ANNOUNCEMENT_PAGE_SIZE };
  }

  const supabase = await createSupabaseServerClient();
  const queryText = search.trim().slice(0, 100).replace(/[%_,*()!\\]/g, "");
  const safePage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1_000_000) : 1;
  let query = supabase
    .from("announcements")
    .select(
      "*, author:profiles!announcements_author_id_fkey(id, full_name, username, avatar_url)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  if (queryText) query = query.or(`title.ilike.%${queryText}%,content.ilike.%${queryText}%`);
  const loadPage = (selectedPage: number) => query
    .range((selectedPage - 1) * ANNOUNCEMENT_PAGE_SIZE, selectedPage * ANNOUNCEMENT_PAGE_SIZE - 1);
  const initial = await loadPage(safePage);
  if (initial.error) throw new Error("Could not load announcements.");
  const totalCount = initial.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(totalCount / ANNOUNCEMENT_PAGE_SIZE));
  const safeLastPage = Math.min(safePage, lastPage);
  const result = safeLastPage === safePage ? initial : await loadPage(safeLastPage);
  if (result.error) throw new Error("Could not load announcements.");
  return {
    announcements: (result.data ?? []) as unknown as AnnouncementWithAuthor[],
    totalCount,
    page: safeLastPage,
    pageSize: ANNOUNCEMENT_PAGE_SIZE,
  };
}

/** Single announcement detail. RLS: published OR leader/admin. */
export async function getAnnouncementDetail(
  id: string,
): Promise<AnnouncementWithAuthor | null> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(
      "*, author:profiles!announcements_author_id_fkey(id, full_name, username, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Could not load this announcement.");
  return data as unknown as AnnouncementWithAuthor;
}
