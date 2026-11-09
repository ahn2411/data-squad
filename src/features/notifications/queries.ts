import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import type { Notification } from "@/types/database";

export const NOTIFICATION_PAGE_SIZE = 20;

export interface NotificationPageResult {
  notifications: Notification[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  unreadCount: number;
}

/**
 * A page of the current user's notifications (RLS: user_id = auth.uid()),
 * ordered unread-first and newest-first within each group. The unread total is
 * independent of the current page so the UI can show the true badge count.
 */
export async function getNotifications(page = 1): Promise<NotificationPageResult> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return {
      notifications: [],
      page: 1,
      pageSize: NOTIFICATION_PAGE_SIZE,
      totalCount: 0,
      totalPages: 1,
      unreadCount: 0,
    };
  }

  const supabase = await createSupabaseServerClient();
  const pageSize = NOTIFICATION_PAGE_SIZE;
  let currentPage = Number.isSafeInteger(page) && page > 0
    ? Math.min(page, 100_000)
    : 1;

  const buildQuery = () => supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  const [pageResult, unreadResult] = await Promise.all([
    buildQuery().range((currentPage - 1) * pageSize, currentPage * pageSize - 1),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);

  if (pageResult.error || unreadResult.error) {
    throw new Error("Could not load notifications.");
  }

  const totalCount = pageResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  let data = pageResult.data;
  if (currentPage > totalPages) {
    currentPage = totalPages;
    const correctedResult = await buildQuery().range(
      (currentPage - 1) * pageSize,
      currentPage * pageSize - 1,
    );
    if (correctedResult.error) throw new Error("Could not load notifications.");
    data = correctedResult.data;
  }

  return {
    notifications: (data ?? []) as unknown as Notification[],
    page: currentPage,
    pageSize,
    totalCount,
    totalPages,
    unreadCount: unreadResult.count ?? 0,
  };
}

/**
 * Count of the current user's unread notifications (read_at is null).
 * Used for the bell badge. RLS: user_id = auth.uid().
 */
export async function getUnreadCount(): Promise<number> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return 0;

  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw new Error("Could not load the unread notification count.");
  return count ?? 0;
}

/**
 * The latest N notifications (for the bell popover). RLS: user_id = auth.uid().
 */
export async function getRecentNotifications(
  limit = 5,
): Promise<Notification[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Could not load recent notifications.");
  return data as unknown as Notification[];
}
