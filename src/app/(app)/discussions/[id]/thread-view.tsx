"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Pin,
  PinOff,
  Lock,
  LockOpen,
  Check,
  Pencil,
  Trash2,
  Reply,
  Loader2,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate, formatDateTime, initials, relativeTime } from "@/lib/format";
import type { ThreadDetail, PostWithAuthor } from "@/features/discussions/queries";
import {
  createPostAction,
  updatePostAction,
  deletePostAction,
  togglePinThreadAction,
  toggleLockThreadAction,
  toggleAnswerAction,
} from "@/features/discussions/actions";

interface ThreadViewProps {
  thread: ThreadDetail;
  currentUserId: string;
  canModerate: boolean;
  isLeader: boolean;
  isLocked: boolean;
}

export function ThreadView({
  thread,
  currentUserId,
  canModerate,
  isLeader,
  isLocked,
}: ThreadViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PostWithAuthor | null>(null);

  // Build the post tree: top-level posts + their direct replies.
  const topLevel = thread.posts.filter((p) => !p.parent_post_id);
  const repliesByParent = new Map<string, PostWithAuthor[]>();
  for (const p of thread.posts) {
    if (p.parent_post_id) {
      const list = repliesByParent.get(p.parent_post_id) ?? [];
      list.push(p);
      repliesByParent.set(p.parent_post_id, list);
    }
  }

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error ?? "Action failed.");
      }
    });
  };

  const onPin = () =>
    run(
      () => togglePinThreadAction(thread.id),
      thread.pinned_at ? "Thread unpinned." : "Thread pinned.",
    );
  const onLock = () =>
    run(
      () => toggleLockThreadAction(thread.id),
      thread.locked_at ? "Thread unlocked." : "Thread locked.",
    );

  return (
    <div className="space-y-4">
      {/* Moderation bar */}
      {canModerate ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="mr-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Moderation
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={pending}
              onClick={onPin}
            >
              {thread.pinned_at ? (
                <>
                  <PinOff className="size-3.5" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="size-3.5" />
                  Pin
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={pending}
              onClick={onLock}
            >
              {thread.locked_at ? (
                <>
                  <LockOpen className="size-3.5" />
                  Unlock
                </>
              ) : (
                <>
                  <Lock className="size-3.5" />
                  Lock
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Locked notice */}
      {isLocked ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-[13px] text-muted-foreground">
          <Lock className="size-4" />
          This thread is locked. New replies are paused
          {isLeader ? " for members — leaders can still post." : "."}
        </div>
      ) : null}

      {/* Posts */}
      {topLevel.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <MessageSquare className="size-6 text-muted-foreground" />
            <p className="mt-2 text-[14px] font-medium text-foreground">
              No posts yet
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Kick off the discussion with the first reply below.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {topLevel.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              replies={repliesByParent.get(post.id) ?? []}
              currentUserId={currentUserId}
              canModerate={canModerate}
              canMarkAnswer={canModerate || thread.created_by === currentUserId}
              pending={pending}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              editingId={editingId}
              setEditingId={setEditingId}
              onDelete={(p) => setDeleteTarget(p)}
              onCreateReply={(body, parentId) =>
                run(
                  () => createPostAction(thread.id, body, parentId),
                  "Reply posted.",
                )
              }
              onUpdate={(postId, body) =>
                run(
                  () => updatePostAction(postId, body),
                  "Post updated.",
                )
              }
              onToggleAnswer={(postId) =>
                run(
                  () => toggleAnswerAction(postId),
                  "Answer marker updated.",
                )
              }
            />
          ))}
        </div>
      )}

      {/* Bottom reply box */}
      {!isLocked || isLeader ? (
        <BottomReplyBox
          threadId={thread.id}
          pending={pending}
          startTransition={startTransition}
          onPosted={() => router.refresh()}
        />
      ) : null}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          {deleteTarget ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                <AlertDialogDescription>
                  The post will be hidden from the thread. The author can still
                  see it was removed in their activity history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    const target = deleteTarget;
                    setDeleteTarget(null);
                    run(
                      () => deletePostAction(target.id),
                      "Post deleted.",
                    );
                  }}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PostCard — a top-level post + its nested replies (one level).
// ─────────────────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: PostWithAuthor;
  replies: PostWithAuthor[];
  currentUserId: string;
  canModerate: boolean;
  canMarkAnswer: boolean;
  pending: boolean;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onDelete: (post: PostWithAuthor) => void;
  onCreateReply: (body: string, parentId: string) => void;
  onUpdate: (postId: string, body: string) => void;
  onToggleAnswer: (postId: string) => void;
}

function PostCard({
  post,
  replies,
  currentUserId,
  canModerate,
  canMarkAnswer,
  pending,
  replyTo,
  setReplyTo,
  editingId,
  setEditingId,
  onDelete,
  onCreateReply,
  onUpdate,
  onToggleAnswer,
}: PostCardProps) {
  const isOwn = post.author_id === currentUserId;
  const authorName =
    post.author?.full_name ?? "Member";
  const isEditing = editingId === post.id;
  const isReplying = replyTo === post.id;
  const [editBody, setEditBody] = React.useState(post.body);
  const [replyBody, setReplyBody] = React.useState("");

  const saveEdit = () => {
    if (!editBody.trim()) {
      toast.error("Body cannot be empty.");
      return;
    }
    onUpdate(post.id, editBody.trim());
    setEditingId(null);
  };

  const submitReply = () => {
    if (!replyBody.trim()) {
      toast.error("Reply cannot be empty.");
      return;
    }
    onCreateReply(replyBody.trim(), post.id);
    setReplyBody("");
    setReplyTo(null);
  };

  return (
    <Card
      className={
        post.is_answer
          ? "border-success/40 bg-success/5"
          : ""
      }
    >
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-3 flex items-start gap-3">
          <Avatar className="size-8 border border-border">
            <AvatarFallback className="bg-primary/10 text-[11px] font-medium text-primary">
              {initials(authorName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium text-foreground">
                {authorName}
              </span>
              {post.is_answer ? (
                <Badge className="bg-success/15 text-success">
                  <CheckCircle2 className="size-3" />
                  Helpful answer
                </Badge>
              ) : null}
              <span className="text-[12px] text-muted-foreground">
                {formatDateTime(post.created_at)}
                {post.updated_at !== post.created_at ? (
                  <> · edited {relativeTime(post.updated_at)}</>
                ) : null}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {canMarkAnswer ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                disabled={pending}
                onClick={() => onToggleAnswer(post.id)}
                aria-label={post.is_answer ? "Unmark as answer" : "Mark as answer"}
                title={post.is_answer ? "Unmark as answer" : "Mark as answer"}
              >
                <Check
                  className={post.is_answer ? "size-4 text-success" : "size-4 text-muted-foreground"}
                />
              </Button>
            ) : null}
            {isOwn ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0"
                  disabled={pending}
                  onClick={() => {
                    if (isEditing) {
                      setEditingId(null);
                    } else {
                      setEditBody(post.body);
                      setEditingId(post.id);
                    }
                  }}
                  aria-label="Edit post"
                  title="Edit"
                >
                  <Pencil className="size-4 text-muted-foreground" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0"
                  disabled={pending}
                  onClick={() => onDelete(post)}
                  aria-label="Delete post"
                  title="Delete"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </>
            ) : null}
            {canModerate && !isOwn ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                disabled={pending}
                onClick={() => onDelete(post)}
                aria-label="Delete post (moderation)"
                title="Delete (moderation)"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            ) : null}
          </div>
        </div>

        {/* Body or editor */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              rows={4}
              className="resize-y"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              maxLength={8000}
            />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">
                {editBody.length}/8000
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setEditingId(null)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={saveEdit}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-foreground">
            {post.body}
          </pre>
        )}

        {/* Reply button */}
        {!isEditing ? (
          <div className="mt-3 border-t border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[12px] text-muted-foreground"
              onClick={() => {
                setReplyTo(isReplying ? null : post.id);
                setEditingId(null);
              }}
            >
              <Reply className="size-3.5" />
              Reply
            </Button>
          </div>
        ) : null}

        {/* Inline reply box */}
        {isReplying ? (
          <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-3">
            <Textarea
              rows={3}
              className="resize-y"
              placeholder={`Reply to ${authorName}…`}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              maxLength={8000}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">
                {replyBody.length}/8000
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setReplyTo(null);
                    setReplyBody("");
                  }}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={submitReply}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Post reply"
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Nested replies (one level) */}
        {replies.length > 0 ? (
          <div className="mt-4 space-y-3 border-l-2 border-border pl-4">
            {replies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                currentUserId={currentUserId}
                canModerate={canModerate}
                canMarkAnswer={canMarkAnswer}
                pending={pending}
                editingId={editingId}
                setEditingId={setEditingId}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onToggleAnswer={onToggleAnswer}
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReplyCard — a single nested reply (no further nesting).
// ─────────────────────────────────────────────────────────────────────────────

interface ReplyCardProps {
  reply: PostWithAuthor;
  currentUserId: string;
  canModerate: boolean;
  canMarkAnswer: boolean;
  pending: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onDelete: (post: PostWithAuthor) => void;
  onUpdate: (postId: string, body: string) => void;
  onToggleAnswer: (postId: string) => void;
}

function ReplyCard({
  reply,
  currentUserId,
  canModerate,
  canMarkAnswer,
  pending,
  editingId,
  setEditingId,
  onDelete,
  onUpdate,
  onToggleAnswer,
}: ReplyCardProps) {
  const isOwn = reply.author_id === currentUserId;
  const authorName =
    reply.author?.full_name ?? "Member";
  const isEditing = editingId === reply.id;
  const [editBody, setEditBody] = React.useState(reply.body);

  const saveEdit = () => {
    if (!editBody.trim()) {
      toast.error("Body cannot be empty.");
      return;
    }
    onUpdate(reply.id, editBody.trim());
    setEditingId(null);
  };

  return (
    <div
      className={`rounded-md border p-3 ${
        reply.is_answer ? "border-success/40 bg-success/5" : "border-border bg-background"
      }`}
    >
      <div className="mb-2 flex items-start gap-2">
        <Avatar className="size-6 border border-border">
          <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
            {initials(authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-foreground">
              {authorName}
            </span>
            {reply.is_answer ? (
              <Badge className="bg-success/15 text-success text-[10px]">
                <CheckCircle2 className="size-2.5" />
                Helpful
              </Badge>
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              {relativeTime(reply.created_at)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {canMarkAnswer ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-6 p-0"
              disabled={pending}
              onClick={() => onToggleAnswer(reply.id)}
              aria-label={reply.is_answer ? "Unmark as answer" : "Mark as answer"}
              title={reply.is_answer ? "Unmark as answer" : "Mark as answer"}
            >
              <Check
                className={reply.is_answer ? "size-3 text-success" : "size-3 text-muted-foreground"}
              />
            </Button>
          ) : null}
          {isOwn ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-6 p-0"
                disabled={pending}
                onClick={() => {
                  if (isEditing) {
                    setEditingId(null);
                  } else {
                    setEditBody(reply.body);
                    setEditingId(reply.id);
                  }
                }}
                aria-label="Edit reply"
              >
                <Pencil className="size-3 text-muted-foreground" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-6 p-0"
                disabled={pending}
                onClick={() => onDelete(reply)}
                aria-label="Delete reply"
              >
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </>
          ) : null}
          {canModerate && !isOwn ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-6 p-0"
              disabled={pending}
              onClick={() => onDelete(reply)}
              aria-label="Delete reply (moderation)"
            >
              <Trash2 className="size-3 text-destructive" />
            </Button>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            rows={3}
            className="resize-y"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            maxLength={8000}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => setEditingId(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7"
              onClick={saveEdit}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-foreground">
          {reply.body}
        </pre>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BottomReplyBox — the always-visible reply box at the end of the thread.
// ─────────────────────────────────────────────────────────────────────────────

interface BottomReplyBoxProps {
  threadId: string;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  onPosted: () => void;
}

function BottomReplyBox({
  threadId,
  pending,
  startTransition,
  onPosted,
}: BottomReplyBoxProps) {
  const [body, setBody] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      toast.error("Reply cannot be empty.");
      return;
    }
    startTransition(async () => {
      const res = await createPostAction(threadId, body.trim());
      if (res.ok) {
        toast.success("Reply posted.");
        setBody("");
        onPosted();
      } else if (!res.ok) {
        toast.error(res.error ?? "Could not post your reply.");
      }
    });
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Reply className="size-3.5" />
            Add a reply
          </div>
          <Textarea
            rows={4}
            className="resize-y"
            placeholder="Share your thoughts, code, or links…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={8000}
          />
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">
              {body.length}/8000
            </span>
            <Button type="submit" size="sm" className="h-9" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Post reply"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
