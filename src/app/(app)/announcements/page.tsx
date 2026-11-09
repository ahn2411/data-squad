import Link from "next/link";
import { Megaphone, Pin, AlertCircle, Search } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PinnedBadge } from "@/features/collaboration/badges";
import {
  getAnnouncements,
  ANNOUNCEMENT_PAGE_SIZE,
  type AnnouncementWithAuthor,
} from "@/features/announcements/queries";
import { formatDate, relativeTime, initials } from "@/lib/format";

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AnnouncementsPage({ searchParams }: PageProps) {
  await requireActiveMember();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let announcements: AnnouncementWithAuthor[] = [];
  let totalCount = 0;
  let currentPage = page;
  let loadError: string | null = null;
  try {
    const result = await getAnnouncements({ search: query, page });
    announcements = result.announcements;
    totalCount = result.totalCount;
    currentPage = result.page;
  } catch {
    loadError = "Could not load announcements right now.";
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Squad-wide updates from your leaders."
      />

      <form action="/announcements" className="mb-5 flex max-w-xl gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query}
            maxLength={100}
            placeholder="Search announcement titles…"
            aria-label="Search announcements by title"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {loadError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
          <AlertCircle className="size-6 text-destructive" />
          <p className="mt-2 text-[14px] font-medium text-foreground">
            {loadError}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Try refreshing the page.
          </p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
          <Megaphone className="size-6 text-muted-foreground" />
          <p className="mt-2 text-[14px] font-medium text-foreground">
            {query ? "No matching announcements" : "No announcements yet"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {query
              ? "Try another title or clear your search."
              : "When your leaders post an update, it will appear here and you’ll get a notification."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {announcements.map((a) => {
              const name = a.author?.full_name ?? "Leader";
              return (
                <Card key={a.id} className={a.pinned ? "border-primary/30" : undefined}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.pinned ? (
                        <Pin className="size-3.5 text-primary" />
                      ) : null}
                      <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
                        {a.title}
                      </h2>
                      {a.pinned ? <PinnedBadge /> : null}
                    </div>

                    <div className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                      <Avatar className="size-5 border border-border">
                        <AvatarFallback className="bg-primary/10 text-[9px] font-medium text-primary">
                          {initials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{name}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <span title={formatDate(a.published_at ?? a.created_at)}>
                        {relativeTime(a.published_at ?? a.created_at)}
                      </span>
                    </div>

                    {a.content ? (
                      <>
                        <Separator className="my-3" />
                        <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
                          {a.content}
                        </p>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Showing {(currentPage - 1) * ANNOUNCEMENT_PAGE_SIZE + 1}–
              {Math.min(currentPage * ANNOUNCEMENT_PAGE_SIZE, totalCount)} of {totalCount}
            </span>
            <div className="flex gap-2">
              {currentPage > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={announcementPageHref(query, currentPage - 1)}>Previous</Link>
                </Button>
              ) : null}
              {currentPage * ANNOUNCEMENT_PAGE_SIZE < totalCount ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={announcementPageHref(query, currentPage + 1)}>Next</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function announcementPageHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("page", String(page));
  return `/announcements?${params.toString()}`;
}
