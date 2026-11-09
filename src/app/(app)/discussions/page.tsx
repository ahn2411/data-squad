import Link from "next/link";
import {
  MessageSquare,
  Pin,
  Lock,
  AlertCircle,
  Plus,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DISCUSSION_PAGE_SIZE,
  getThreads,
  type ThreadPageResult,
  type ThreadWithAuthor,
} from "@/features/discussions/queries";
import { DISCUSSION_CATEGORIES } from "@/features/discussions/schemas";
import { NewThreadDialog } from "./new-thread-dialog";
import { DiscussionsFilters } from "./discussions-filters";
import { formatDate, initials, relativeTime } from "@/lib/format";

export const metadata = { title: "Discussions" };

interface PageProps {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>;
}

export default async function DiscussionsPage({ searchParams }: PageProps) {
  const session = await requireActiveMember();
  const sp = await searchParams;

  const category =
    typeof sp.category === "string" &&
    sp.category !== "all" &&
    DISCUSSION_CATEGORIES.some((candidate) => candidate === sp.category)
      ? sp.category
      : undefined;
  const search = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) || undefined : undefined;
  const parsedPage = typeof sp.page === "string" ? Number(sp.page) : 1;
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0
    ? parsedPage
    : 1;

  let threadPage: ThreadPageResult = {
    threads: [],
    page: 1,
    pageSize: DISCUSSION_PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
  };
  let loadError: string | null = null;
  try {
    threadPage = await getThreads({ category, search, page: requestedPage });
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

  const threads: ThreadWithAuthor[] = threadPage.threads;
  const currentCategory = category ?? "all";
  const firstPageItem = threadPage.totalCount === 0
    ? 0
    : (threadPage.page - 1) * threadPage.pageSize + 1;
  const lastPageItem = Math.min(threadPage.page * threadPage.pageSize, threadPage.totalCount);
  const pageWindowStart = Math.max(1, Math.min(threadPage.page - 2, threadPage.totalPages - 4));
  const pageWindowEnd = Math.min(threadPage.totalPages, pageWindowStart + 4);

  return (
    <>
      <PageHeader
        title="Discussions"
        description="Ask questions, share resources, and collaborate with the squad."
        action={<NewThreadDialog categories={DISCUSSION_CATEGORIES} />}
      />

      <DiscussionsFilters
        key={`${currentCategory}:${search ?? ""}`}
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
                thread.author?.full_name ?? "Member";
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

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span>
          Showing <span className="nums font-medium text-foreground">{firstPageItem}–{lastPageItem}</span>
          {" of "}
          <span className="nums font-medium text-foreground">{threadPage.totalCount}</span>
          {threadPage.totalCount === 1 ? " thread" : " threads"}
        </span>
        {currentCategory !== "all" ? (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span>filtered by {currentCategory}</span>
          </>
        ) : null}
      </div>

      {threadPage.totalPages > 1 ? (
        <nav
          aria-label="Discussion pages"
          className="mt-4 flex flex-wrap items-center justify-center gap-1.5"
        >
          {threadPage.page > 1 ? (
            <Link
              href={discussionPageHref(threadPage.page - 1, currentCategory, search)}
              rel="prev"
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              <ChevronLeft className="size-4" /> Previous
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-[12px] text-muted-foreground/50" aria-disabled="true">
              <ChevronLeft className="size-4" /> Previous
            </span>
          )}
          {Array.from(
            { length: pageWindowEnd - pageWindowStart + 1 },
            (_, index) => pageWindowStart + index,
          ).map((pageNumber) => (
            <Link
              key={pageNumber}
              href={discussionPageHref(pageNumber, currentCategory, search)}
              aria-current={pageNumber === threadPage.page ? "page" : undefined}
              aria-label={`Page ${pageNumber}`}
              className={`inline-flex size-9 items-center justify-center rounded-md border text-[12px] font-medium transition-colors ${
                pageNumber === threadPage.page
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-accent"
              }`}
            >
              {pageNumber}
            </Link>
          ))}
          {threadPage.page < threadPage.totalPages ? (
            <Link
              href={discussionPageHref(threadPage.page + 1, currentCategory, search)}
              rel="next"
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              Next <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-[12px] text-muted-foreground/50" aria-disabled="true">
              Next <ChevronRight className="size-4" />
            </span>
          )}
        </nav>
      ) : null}
    </>
  );
}

function discussionPageHref(page: number, category: string, search?: string): string {
  const params = new URLSearchParams();
  if (category !== "all") params.set("category", category);
  if (search) params.set("q", search);
  params.set("page", String(page));
  return `/discussions?${params.toString()}`;
}
