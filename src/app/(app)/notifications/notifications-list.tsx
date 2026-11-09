"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCheck, Loader2, BellOff, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { safeInternalPath } from "@/lib/utils";
import {
  notificationIcon,
  notificationLabel,
} from "@/features/collaboration/badges";
import { relativeTime } from "@/lib/format";
import { markNotificationReadAction, markAllReadAction } from "@/features/notifications/actions";
import type { Notification, NotificationType } from "@/types/database";

interface NotificationsListProps {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function NotificationsList({
  notifications,
  unreadCount,
  totalCount,
  page,
  pageSize,
  totalPages,
}: NotificationsListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const firstItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalCount);

  const handleMarkAll = () => {
    startTransition(async () => {
      try {
        const res = await markAllReadAction();
        if (res.ok) {
          toast.success("All notifications marked as read.");
          router.refresh();
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("Could not update notifications. Please try again.");
      }
    });
  };

  const handleClick = (
    n: Notification,
    e: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    // If unread, mark it read first (server action), then navigate.
    if (n.read_at === null && n.link) {
      const href = safeInternalPath(n.link);
      if (!href) {
        e.preventDefault();
        toast.error("This notification link is unavailable.");
        return;
      }
      e.preventDefault();
      setBusyId(n.id);
      startTransition(async () => {
        try {
          const res = await markNotificationReadAction(n.id);
          if (!res.ok) toast.error(res.error);
        } catch {
          toast.error("Could not update notification status.");
        } finally {
          // Navigate regardless — the user wants to see the entity.
          router.push(href);
          router.refresh();
          setBusyId(null);
        }
      });
    }
    // If already read or no link, the anchor's href navigates naturally.
  };

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
        <BellOff className="size-6 text-muted-foreground" />
        <p className="mt-2 text-[14px] font-medium text-foreground">
          You&apos;re all caught up
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Notifications about access reviews, submissions, announcements, and
          assignments will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          Showing <span className="nums font-medium text-foreground">{firstItem}–{lastItem}</span>
          {" of "}
          <span className="nums font-medium text-foreground">{totalCount}</span>{" "}
          {totalCount === 1 ? "notification" : "notifications"}
          {unreadCount > 0 ? (
            <>
              <span className="text-muted-foreground/50">·</span>{" "}
              <span className="nums font-medium text-warning">
                {unreadCount}
              </span>{" "}
              unread
            </>
          ) : null}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={pending || unreadCount === 0}
          onClick={handleMarkAll}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCheck className="size-3.5" />
          )}
          Mark all read
        </Button>
      </div>

      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        {notifications.map((n) => {
          const Icon = notificationIcon(n.type as NotificationType);
          const isUnread = n.read_at === null;
          const isBusy = busyId === n.id;
          const href = safeInternalPath(n.link);
          const rowClassName = `flex gap-3 px-4 py-3 transition-colors ${
            href ? "hover:bg-accent/40 cursor-pointer" : ""
          } ${isUnread ? "bg-primary/[0.03]" : ""}`;
          const inner = (
            <>
              <div
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${
                  isUnread
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {n.title}
                  </p>
                  {isUnread ? (
                    <span
                      aria-label="Unread"
                      className="ml-auto size-2 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                </div>
                {n.body ? (
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                    {n.body}
                  </p>
                ) : null}
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-muted-foreground/80">
                    {notificationLabel(n.type as NotificationType)}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span title={n.created_at}>
                    {relativeTime(n.created_at)}
                  </span>
                </div>
              </div>
            </>
          );
          return (
            <li
              key={n.id}
              className="border-b border-border last:border-b-0"
            >
              {href ? (
                <a
                  href={href}
                  onClick={(e) => handleClick(n, e)}
                  className={rowClassName}
                >
                  {inner}
                </a>
              ) : (
                <div className={rowClassName}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>

      {totalPages > 1 ? (
        <nav aria-label="Notification pages" className="flex flex-wrap items-center justify-center gap-1.5">
          {page > 1 ? (
            <Link
              href={`/notifications?page=${page - 1}`}
              rel="prev"
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              <ChevronLeft className="size-4" /> Previous
            </Link>
          ) : (
            <span aria-disabled="true" className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-[12px] text-muted-foreground/50">
              <ChevronLeft className="size-4" /> Previous
            </span>
          )}
          <span className="px-2 text-[12px] text-muted-foreground" aria-live="polite">
            Page <span className="nums font-medium text-foreground">{page}</span> of{" "}
            <span className="nums font-medium text-foreground">{totalPages}</span>
          </span>
          {page < totalPages ? (
            <Link
              href={`/notifications?page=${page + 1}`}
              rel="next"
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              Next <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span aria-disabled="true" className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-[12px] text-muted-foreground/50">
              Next <ChevronRight className="size-4" />
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
