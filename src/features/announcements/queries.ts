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

/**
 * Member-visible announcements: published only (RLS enforces this).
 * Pinned first, then by published_at desc.
 */
export async function getAnnouncements(): Promise<AnnouncementWithAuthor[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];

  const supabase = await createSupabaseServerClient();

  // Fetch all rows RLS lets us see (members see published only; leaders/admins
  // see all — but we filter to published here for the member-facing page).
  const { data, error } = await supabase
    .from("announcements")
    .select(
      "*, author:profiles!announcements_author_id_fkey(id, email, full_name, username, avatar_url)",
    )
    .eq("status", "published")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return data as unknown as AnnouncementWithAuthor[];
}

/**
 * Admin/leader: all announcements (drafts + published + archived).
 * Ordered by created_at desc.
 */
export async function getAdminAnnouncements(): Promise<AnnouncementWithAuthor[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(
      "*, author:profiles!announcements_author_id_fkey(id, email, full_name, username, avatar_url)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as unknown as AnnouncementWithAuthor[];
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
      "*, author:profiles!announcements_author_id_fkey(id, email, full_name, username, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as AnnouncementWithAuthor;
}
