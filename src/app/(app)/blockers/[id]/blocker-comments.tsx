"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatDateTime, relativeTime } from "@/lib/format";
import {
  createCommentSchema,
  type CreateCommentValues,
} from "@/features/blockers/schemas";
import {
  createBlockerCommentAction,
  deleteBlockerCommentAction,
} from "@/features/blockers/actions";
import type { BlockerDetail } from "@/features/blockers/queries";

interface BlockerCommentsProps {
  blockerId: string;
  comments: BlockerDetail["comments"];
  currentUserId: string;
}

const formSchema = createCommentSchema;
type FormValues = CreateCommentValues;

export function BlockerComments({
  blockerId,
  comments,
  currentUserId,
}: BlockerCommentsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { body: "" },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const res = await createBlockerCommentAction(blockerId, values);
      if (res.ok) {
        toast.success("Comment posted.");
        form.reset({ body: "" });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = (commentId: string) => {
    setDeletingId(commentId);
    startTransition(async () => {
      const res = await deleteBlockerCommentAction(commentId);
      if (res.ok) {
        toast.success("Comment deleted.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
      setDeletingId(null);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">
          Comments
        </CardTitle>
        <CardDescription className="text-[12px]">
          Discuss the blocker or share hints. Anyone who can see the blocker
          can post.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-[12px] text-muted-foreground">
            No comments yet. Be the first to weigh in.
          </p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => {
              const name = c.author?.full_name ?? c.author?.email ?? "Member";
              const isOwn = c.author?.id === currentUserId;
              return (
                <li key={c.id} className="flex gap-3">
                  <Avatar className="size-8 border border-border">
                    <AvatarFallback className="bg-primary/10 text-[11px] font-medium text-primary">
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {name}
                      </span>
                      <span
                        className="text-[11px] text-muted-foreground"
                        title={formatDateTime(c.created_at)}
                      >
                        {relativeTime(c.created_at)}
                      </span>
                      {isOwn ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto size-6 text-muted-foreground hover:text-destructive"
                          aria-label="Delete your comment"
                          disabled={pending && deletingId === c.id}
                          onClick={() => handleDelete(c.id)}
                        >
                          {pending && deletingId === c.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
                      {c.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      rows={3}
                      className="resize-y"
                      placeholder="Add a comment…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Post comment
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
