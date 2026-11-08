import Link from "next/link";
import {
  MessageSquare,
  Pin,
  Lock,
  AlertCircle,
  Plus,
  ArrowRight,
} from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getThreads, type ThreadWithAuthor } from "@/features/discussions/queries";
import { DISCUSSION_CATEGORIES } from "@/features/discussions/schemas";
import { NewThreadDialog } from "./new-thread-dialog";
import { DiscussionsFilters } from "./discussions-filters";
import { formatDate, initials, relativeTime } from "@/lib/format";

export const metadata = { title: "Discussions" };

interface PageProps {
  searchParams: Promise<{ category?: string; q?: string }>;
}

export default async function DiscussionsPage({ searchParams }: PageProps) {
  const session = await requireActiveMember();
  const sp = await searchParams;

  const category =
    typeof sp.category === "string" && sp.category !== "all"
      ? sp.category
      : undefined;
  const search = typeof sp.q === "string" ? sp.q : undefined;

  let threads: ThreadWithAuthor[] = [];
  let loadError: string | null = null;
  try {
    threads = await getThreads({ category, search });
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Could not load discussions.";
  }

  if (loadError) {
    return (
      <>
        <PageHeader
          title="Discussions"
          description="Ask questions, share resources, and collaborate with the squad."
        />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </>
    );
  }

  const currentCategory = category ?? "all";

  return (
    <>
      <PageHeader
        title="Discussions"
        description="Ask questions, share resources, and collaborate with the squad."
        action={<NewThreadDialog categories={DISCUSSION_CATEGORIES} />}
      />

      <DiscussionsFilters
        categories={DISCUSSION_CATEGORIES}
        currentCategory={currentCategory}
        currentSearch={search ?? ""}
      />

      {threads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <MessageSquare className="size-6 text-muted-foreground" />
            <p className="mt-2 text-[14px] font-medium text-foreground">
              {search || category
                ? "No threads match these filters."
                : "No discussions yet."}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {search || category
                ? "Try clearing the filters or search for something else."
                : "Start the conversation — ask a question or share a resource."}
            </p>
            {search || category ? null : (
              <div className="mt-4">
                <NewThreadDialog
                  categories={DISCUSSION_CATEGORIES}
                  trigger={
                    <button className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                      <Plus className="size-4" />
                      Start a discussion
                    </button>
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {threads.map((thread) => {
              const authorName =
                thread.author?.full_name ?? thread.author?.email ?? "Member";
              const isPinned = Boolean(thread.pinned_at);
              const isLocked = Boolean(thread.locked_at);
              return (
                <li key={thread.id} className="group">
                  <Link
                    href={`/discussions/${thread.id}`}
                    className="flex items-start gap-3 p-4 transition-colors hover:bg-accent/40 sm:p-6"
                  >
                    <Avatar className="size-9 shrink-0 border border-border">
                      <AvatarFallback className="bg-primary/10 text-[12px] font-medium text-primary">
                        {initials(authorName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isPinned ? (
                          <Pin className="size-3.5 text-primary" />
                        ) : null}
                        <h3 className="truncate text-[14px] font-semibold text-foreground">
                          {thread.title}
                        </h3>
                        {isLocked ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal text-muted-foreground"
                          >
                            <Lock className="size-3" />
                            Locked
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className="text-[11px] font-normal text-muted-foreground"
                        >
                          {thread.category}
                        </Badge>
                      </div>
                      <p className="text-[12px] text-muted-foreground">
                        Started by {authorName} · {formatDate(thread.created_at)}
                        {thread.last_activity
                          ? ` · last activity ${relativeTime(thread.last_activity)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-[12px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3.5" />
                        <span className="nums font-medium text-foreground">
                          {thread.post_count}
                        </span>
                        {thread.post_count === 1 ? "post" : "posts"}
                      </span>
                      <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="nums font-medium text-foreground">{threads.length}</span>
        {threads.length === 1 ? "thread" : "threads"}
        {currentCategory !== "all" ? (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span>filtered by {currentCategory}</span>
          </>
        ) : null}
      </div>
    </>
  );
}
