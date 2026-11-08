"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCheck, Loader2, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  notificationIcon,
  notificationLabel,
} from "@/features/collaboration/badges";
import { relativeTime } from "@/lib/format";
import { markNotificationReadAction, markAllReadAction } from "@/features/notifications/actions";
import type { Notification, NotificationType } from "@/types/database";

interface NotificationsListProps {
  notifications: Notification[];
}

export function NotificationsList({ notifications }: NotificationsListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  const handleMarkAll = () => {
    startTransition(async () => {
      const res = await markAllReadAction();
      if (res.ok) {
        toast.success("All notifications marked as read.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleClick = (
    n: Notification,
    e: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    // If unread, mark it read first (server action), then navigate.
    if (n.read_at === null && n.link) {
      e.preventDefault();
      setBusyId(n.id);
      startTransition(async () => {
        const res = await markNotificationReadAction(n.id);
        if (!res.ok) toast.error(res.error);
        // Navigate regardless — the user wants to see the entity.
        router.push(n.link as string);
        router.refresh();
        setBusyId(null);
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
          Notifications about reviews, announcements, and new assignments will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          <span className="nums font-medium text-foreground">
            {notifications.length}
          </span>{" "}
          {notifications.length === 1 ? "notification" : "notifications"}
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
          const href = n.link ?? null;
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
    </div>
  );
}
