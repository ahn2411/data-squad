import { Megaphone, Pin, AlertCircle } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PinnedBadge } from "@/features/collaboration/badges";
import {
  getAnnouncements,
  type AnnouncementWithAuthor,
} from "@/features/announcements/queries";
import { formatDate, relativeTime, initials } from "@/lib/format";

export default async function AnnouncementsPage() {
  const session = await requireActiveMember();

  let announcements: AnnouncementWithAuthor[] = [];
  let loadError: string | null = null;
  try {
    announcements = await getAnnouncements();
  } catch {
    loadError = "Could not load announcements right now.";
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Squad-wide updates from your leaders."
      />

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
            No announcements yet
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            When your leaders post an update, it will appear here and you&apos;ll
            get a notification.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const name = a.author?.full_name ?? a.author?.email ?? "Leader";
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
      )}
    </>
  );
}
