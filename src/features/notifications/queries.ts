import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";
import type { Notification } from "@/types/database";

/**
 * The current user's notifications (RLS: user_id = auth.uid()).
 * Unread first, then created_at desc.
 */
export async function getNotifications(): Promise<Notification[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as unknown as Notification[];
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

  if (error) return 0;
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

  if (error || !data) return [];
  return data as unknown as Notification[];
}
