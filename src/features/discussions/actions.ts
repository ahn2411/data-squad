"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import {
  createThreadSchema,
  createPostSchema,
  updatePostSchema,
  type CreateThreadValues,
  type CreatePostValues,
  type UpdatePostValues,
} from "./schemas";

export type DiscussionActionResult =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: string };

async function requireActive(): Promise<
  | { ok: true; teamId: string; userId: string; role: "admin" | "leader" | "member" }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { ok: false, error: "You must be an active member." };
  }
  return {
    ok: true,
    teamId: ctx.membership.team_id,
    userId: ctx.userId,
    role: ctx.membership.role,
  };
}

function isLeaderOrAdmin(role: "admin" | "leader" | "member"): boolean {
  return role === "admin" || role === "leader";
}

/** Create a new thread. Returns the new thread id so the client can navigate. */
export async function createThreadAction(
  values: CreateThreadValues,
): Promise<DiscussionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const parsed = createThreadSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discussion_threads")
    .insert({
      team_id: user.teamId,
      title: v.title,
      category: v.category,
      created_by: user.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not create the discussion." };
  }

  revalidatePath("/discussions");
  return { ok: true, redirectTo: `/discussions/${data.id}` };
}

/**
 * Create a post (top-level or reply). If the thread is locked, only leaders
 * /admins can still post.
 */
export async function createPostAction(
  threadId: string,
  body: string,
  parentPostId?: string | null,
): Promise<DiscussionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  const parsed = createPostSchema.safeParse({
    body,
    parentPostId: parentPostId ?? null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  if (!/^[0-9a-f-]{36}$/i.test(threadId)) {
    return { ok: false, error: "Invalid thread id." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify the thread exists, is in the caller's team, and is not locked
  // (unless the caller is a leader/admin).
  const { data: thread } = await supabase
    .from("discussion_threads")
    .select("id, team_id, locked_at")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) {
    return { ok: false, error: "Thread not found." };
  }
  if (thread.team_id !== user.teamId) {
    return { ok: false, error: "Thread is not in your team." };
  }
  if (thread.locked_at && !isLeaderOrAdmin(user.role)) {
    return { ok: false, error: "This thread is locked." };
  }

  // If a parent_post_id is supplied, verify it belongs to the same thread.
  if (v.parentPostId) {
    const { data: parent } = await supabase
      .from("discussion_posts")
      .select("id, thread_id, deleted_at")
      .eq("id", v.parentPostId)
      .maybeSingle();
    if (!parent || parent.thread_id !== threadId || parent.deleted_at) {
      return { ok: false, error: "Parent post not found in this thread." };
    }
  }

  const { error } = await supabase.from("discussion_posts").insert({
    thread_id: threadId,
    author_id: user.userId,
    parent_post_id: v.parentPostId ?? null,
    body: v.body,
  });

  if (error) {
    return { ok: false, error: "Could not post your reply." };
  }

  revalidatePath("/discussions");
  revalidatePath(`/discussions/${threadId}`);
  return { ok: true };
}

/** Edit your own post (RLS also enforces author_id = auth.uid()). */
export async function updatePostAction(
  postId: string,
  body: string,
): Promise<DiscussionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  if (!/^[0-9a-f-]{36}$/i.test(postId)) {
    return { ok: false, error: "Invalid post id." };
  }

  const parsed = updatePostSchema.safeParse({ body });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify ownership + grab thread_id for revalidation.
  const { data: post } = await supabase
    .from("discussion_posts")
    .select("id, author_id, thread_id, deleted_at")
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    return { ok: false, error: "Post not found." };
  }
  if (post.deleted_at) {
    return { ok: false, error: "Cannot edit a deleted post." };
  }
  if (post.author_id !== user.userId) {
    return { ok: false, error: "You can only edit your own posts." };
  }

  const { error } = await supabase
    .from("discussion_posts")
    .update({ body: parsed.data.body })
    .eq("id", postId);

  if (error) {
    return { ok: false, error: "Could not save your edit." };
  }

  revalidatePath(`/discussions/${post.thread_id}`);
  return { ok: true };
}

/**
 * Soft-delete a post. Author or leader/admin. Sets deleted_at = now; the row
 * stays for audit but is hidden from the thread view.
 */
export async function deletePostAction(
  postId: string,
): Promise<DiscussionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  if (!/^[0-9a-f-]{36}$/i.test(postId)) {
    return { ok: false, error: "Invalid post id." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: post } = await supabase
    .from("discussion_posts")
    .select("id, author_id, thread_id, deleted_at")
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    return { ok: false, error: "Post not found." };
  }
  if (post.deleted_at) {
    return { ok: false, error: "Post is already deleted." };
  }
  if (post.author_id !== user.userId && !isLeaderOrAdmin(user.role)) {
    return { ok: false, error: "You can only delete your own posts." };
  }

  const { error } = await supabase
    .from("discussion_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) {
    return { ok: false, error: "Could not delete the post." };
  }

  revalidatePath("/discussions");
  revalidatePath(`/discussions/${post.thread_id}`);
  return { ok: true };
}

/**
 * Toggle a thread's pinned state. Author or leader/admin. Pin sets pinned_at
 * = now; unpin sets it to null.
 */
export async function togglePinThreadAction(
  threadId: string,
): Promise<DiscussionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  if (!/^[0-9a-f-]{36}$/i.test(threadId)) {
    return { ok: false, error: "Invalid thread id." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: thread } = await supabase
    .from("discussion_threads")
    .select("id, team_id, created_by, pinned_at")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) {
    return { ok: false, error: "Thread not found." };
  }
  if (thread.team_id !== user.teamId) {
    return { ok: false, error: "Thread is not in your team." };
  }
  if (thread.created_by !== user.userId && !isLeaderOrAdmin(user.role)) {
    return { ok: false, error: "Only the author or a leader/admin can pin a thread." };
  }

  const nextPinned = thread.pinned_at ? null : new Date().toISOString();
  const { error } = await supabase
    .from("discussion_threads")
    .update({ pinned_at: nextPinned })
    .eq("id", threadId);

  if (error) {
    return { ok: false, error: "Could not update the thread." };
  }

  revalidatePath("/discussions");
  revalidatePath(`/discussions/${threadId}`);
  return { ok: true };
}

/**
 * Toggle a thread's locked state. Author or leader/admin. Lock sets
 * locked_at = now; unlock sets it to null.
 */
export async function toggleLockThreadAction(
  threadId: string,
): Promise<DiscussionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  if (!/^[0-9a-f-]{36}$/i.test(threadId)) {
    return { ok: false, error: "Invalid thread id." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: thread } = await supabase
    .from("discussion_threads")
    .select("id, team_id, created_by, locked_at")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) {
    return { ok: false, error: "Thread not found." };
  }
  if (thread.team_id !== user.teamId) {
    return { ok: false, error: "Thread is not in your team." };
  }
  if (thread.created_by !== user.userId && !isLeaderOrAdmin(user.role)) {
    return { ok: false, error: "Only the author or a leader/admin can lock a thread." };
  }

  const nextLocked = thread.locked_at ? null : new Date().toISOString();
  const { error } = await supabase
    .from("discussion_threads")
    .update({ locked_at: nextLocked })
    .eq("id", threadId);

  if (error) {
    return { ok: false, error: "Could not update the thread." };
  }

  revalidatePath("/discussions");
  revalidatePath(`/discussions/${threadId}`);
  return { ok: true };
}

/**
 * Toggle the is_answer flag on a post. Leader/admin OR the thread's author can
 * mark a post as the helpful answer.
 */
export async function toggleAnswerAction(
  postId: string,
): Promise<DiscussionActionResult> {
  const user = await requireActive();
  if (!user.ok) return user;

  if (!/^[0-9a-f-]{36}$/i.test(postId)) {
    return { ok: false, error: "Invalid post id." };
  }

  const supabase = await createSupabaseServerClient();

  // Need the post + its thread's author + team to authorize.
  const { data: post } = await supabase
    .from("discussion_posts")
    .select("id, thread_id, deleted_at, is_answer")
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    return { ok: false, error: "Post not found." };
  }
  if (post.deleted_at) {
    return { ok: false, error: "Cannot mark a deleted post." };
  }

  const { data: thread } = await supabase
    .from("discussion_threads")
    .select("id, team_id, created_by")
    .eq("id", post.thread_id)
    .maybeSingle();

  if (!thread) {
    return { ok: false, error: "Thread not found." };
  }
  if (thread.team_id !== user.teamId) {
    return { ok: false, error: "Thread is not in your team." };
  }

  const canMark =
    isLeaderOrAdmin(user.role) || thread.created_by === user.userId;
  if (!canMark) {
    return {
      ok: false,
      error: "Only the thread author or a leader/admin can mark an answer.",
    };
  }

  const { error } = await supabase
    .from("discussion_posts")
    .update({ is_answer: !post.is_answer })
    .eq("id", postId);

  if (error) {
    return { ok: false, error: "Could not update the post." };
  }

  revalidatePath(`/discussions/${post.thread_id}`);
  return { ok: true };
}
