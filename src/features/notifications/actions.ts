"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";

export type NotificationActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireActive(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { ok: false, error: "You must be an active member." };
  }
  return { ok: true, userId: ctx.userId };
}

/**
 * Mark a single notification as read (set read_at = now). RLS enforces
 * user_id = auth.uid(); we also verify ownership for a clean error.
 *
 * NOTE: Notifications are NEVER inserted from actions — they come only from
 * DB triggers (including pending-member, review, announcement, and assignment
 * events). This action only marks-read.
 */
export async function markNotificationReadAction(
  id: string,
): Promise<NotificationActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const supabase = await createSupabaseServerClient();

  // Verify ownership before update (RLS would also block non-owners).
  const { data: existing } = await supabase
    .from("notifications")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Notification not found." };
  if (existing.user_id !== user.userId) {
    // Defensive: RLS would also reject this; surface a clean message.
    return { ok: false, error: "You can only manage your own notifications." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  if (error) return { ok: false, error: "Could not mark the notification." };

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Mark all of the current user's unread notifications as read.
 * RLS: user_id = auth.uid(); the IS NULL predicate narrows to unread.
 */
export async function markAllReadAction(): Promise<NotificationActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) return { ok: false, error: "Could not mark all as read." };

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}
