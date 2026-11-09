"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  announcementIdSchema,
  type CreateAnnouncementValues,
  type UpdateAnnouncementValues,
  type AnnouncementIdValues,
} from "./schemas";

export type AnnouncementActionResult =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: string };

async function requireLeader(): Promise<
  | { ok: true; teamId: string; userId: string }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { ok: false, error: "You must be an active member." };
  }
  if (ctx.membership.role !== "admin" && ctx.membership.role !== "leader") {
    return {
      ok: false,
      error: "Only leaders and admins can manage announcements.",
    };
  }
  return { ok: true, teamId: ctx.membership.team_id, userId: ctx.userId };
}

function nullIfEmpty(v: string | undefined | null): string | null {
  if (!v || v.trim() === "") return null;
  return v;
}

/**
 * Create an announcement (leader/admin only).
 *
 * IMPORTANT: if status='published', the notify_on_announcement DB trigger
 * automatically inserts a notification row for each active team member.
 * We do NOT insert notifications here. The trigger is SECURITY DEFINER and
 * bypasses RLS to fan out the notifications.
 */
export async function createAnnouncementAction(
  values: CreateAnnouncementValues,
): Promise<AnnouncementActionResult> {
  const leader = await requireLeader();
  if (!leader.ok) return leader;

  const parsed = createAnnouncementSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      team_id: leader.teamId,
      title: v.title,
      content: nullIfEmpty(v.content),
      author_id: leader.userId,
      pinned: v.pinned,
      status: v.status,
      // published_at is set now if publishing immediately. The
      // notify_on_announcement trigger fires AFTER insert with status='published'.
      published_at:
        v.status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not create the announcement." };
  }

  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true, redirectTo: `/announcements` };
}

/**
 * Update an existing announcement (leader/admin only).
 *
 * Publishing (status='published' for the first time) sets published_at=now and
 * fires the notify_on_announcement trigger (which guards against re-firing on
 * updates when the row was already published).
 */
export async function updateAnnouncementAction(
  values: UpdateAnnouncementValues,
): Promise<AnnouncementActionResult> {
  const leader = await requireLeader();
  if (!leader.ok) return leader;

  const parsed = updateAnnouncementSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Fetch the current row to detect first-publish (preserve first published_at).
  const { data: current, error: currentError } = await supabase
    .from("announcements")
    .select("status, published_at")
    .eq("id", v.id)
    .maybeSingle();

  if (currentError) return { ok: false, error: "Could not load the announcement before saving." };
  if (!current) return { ok: false, error: "Announcement not found." };

  const wasPublished = current.status === "published";
  const nowPublished = v.status === "published";

  const { data: updated, error } = await supabase
    .from("announcements")
    .update({
      title: v.title,
      content: nullIfEmpty(v.content),
      pinned: v.pinned,
      status: v.status,
      published_at: nowPublished
        ? wasPublished
          ? current.published_at // preserve first-published timestamp
          : new Date().toISOString()
        : null,
    })
    .eq("id", v.id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return { ok: false, error: "Could not save the announcement." };
  }

  revalidatePath("/announcements");
  revalidatePath(`/announcements`);
  revalidatePath("/admin/announcements");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Hard delete (allowed by RLS). Prefer archiveAnnouncementAction for audit
 * trail, but exposed here as a destructive fallback for draft cleanup.
 */
export async function deleteAnnouncementAction(
  values: AnnouncementIdValues,
): Promise<AnnouncementActionResult> {
  const leader = await requireLeader();
  if (!leader.ok) return leader;

  const parsed = announcementIdSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid announcement id." };

  const supabase = await createSupabaseServerClient();
  const { data: deleted, error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", parsed.data.announcementId)
    .select("id")
    .maybeSingle();

  if (error || !deleted) return { ok: false, error: "Could not delete the announcement. It may have already been removed." };

  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true, redirectTo: "/admin/announcements" };
}

/**
 * Archive an announcement: status='archived', archived_at=now.
 * Members no longer see it. Notifications already sent remain.
 */
export async function archiveAnnouncementAction(
  values: AnnouncementIdValues,
): Promise<AnnouncementActionResult> {
  const leader = await requireLeader();
  if (!leader.ok) return leader;

  const parsed = announcementIdSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid announcement id." };

  const supabase = await createSupabaseServerClient();
  const { data: archived, error } = await supabase
    .from("announcements")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.announcementId)
    .select("id")
    .maybeSingle();

  if (error || !archived) return { ok: false, error: "Could not archive the announcement. It may have already changed." };

  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}
