"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  Menu,
  PanelLeftClose,
  PanelLeft,
  Bell,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import type { NavSection } from "./sidebar-nav-data";
import type { TeamRole, NotificationType } from "@/types/database";
import {
  notificationIcon,
  notificationLabel,
} from "@/features/collaboration/badges";
import { relativeTime } from "@/lib/format";
import { markNotificationReadAction, markAllReadAction } from "@/features/notifications/actions";

interface BellNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

interface AppShellProps {
  sections: NavSection[];
  initialCollapsed: boolean;
  user: {
    name: string | null;
    email: string;
    role: TeamRole;
  };
  unreadCount?: number;
  recentNotifications?: BellNotification[];
  children: React.ReactNode;
}

/** Map known routes to a top-bar page title (Phase 2 routes only). */
function pageTitle(pathname: string): string {
  if (pathname.startsWith("/admin/assignments")) return "Assignment management";
  if (pathname.startsWith("/admin/roadmap")) return "Roadmap manager";
  if (pathname.startsWith("/assignments/")) return "Assignment details";
  if (pathname.startsWith("/submissions/")) return "Submission details";
  if (pathname.startsWith("/weekly-reports/")) return "Weekly report";
  if (pathname.startsWith("/discussions/")) return "Discussion";
  if (pathname.startsWith("/blockers/")) return "Blocker details";
  switch (pathname) {
    case "/dashboard":
      return "Overview";
    case "/profile":
      return "Profile";
    case "/admin/members":
      return "Members";
    case "/blockers":
      return "Blockers";
    case "/announcements":
      return "Announcements";
    case "/notifications":
      return "Notifications";
    case "/roadmap":
      return "Learning roadmap";
    case "/assignments":
      return "Assignments";
    case "/submissions":
      return "Submissions";
    case "/weekly-reports":
      return "Weekly reports";
    case "/discussions":
      return "Discussions";
    case "/admin/announcements":
      return "Announcements";
    case "/admin/assignments":
      return "Assignment management";
    case "/admin/roadmap":
      return "Roadmap manager";
    default:
      return "Squad Hub";
  }
}

export function AppShell({
  sections,
  user,
  initialCollapsed,
  unreadCount = 0,
  recentNotifications = [],
  children,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);

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

  const handleNotificationClick = (
    n: BellNotification,
    e: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    if (!n.link) return;
    if (n.read_at === null) {
      // Mark read first, then navigate.
      e.preventDefault();
      setBusyId(n.id);
      startTransition(async () => {
        const res = await markNotificationReadAction(n.id);
        if (!res.ok) toast.error(res.error);
        router.push(n.link as string);
        router.refresh();
        setBusyId(null);
      });
    }
  };

  const renderSidebar = (isCollapsed: boolean) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-sidebar-border",
          isCollapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Logo showWordmark={!isCollapsed} />
      </div>

      <ScrollArea className="flex-1">
        <SidebarNav
          sections={sections}
          collapsed={isCollapsed}
          onNavigate={() => setMobileOpen(false)}
        />
      </ScrollArea>

      <Separator className="bg-sidebar-border" />
      <div className="p-2">
        <UserMenu
          name={user.name}
          email={user.email}
          role={user.role}
          collapsed={isCollapsed}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "relative hidden flex-none flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out md:flex",
          collapsed ? "w-14" : "w-60",
        )}
      >
        {renderSidebar(collapsed)}
        <button
          type="button"
          onClick={() => {
            const nextCollapsed = !collapsed;
            setCollapsed(nextCollapsed);
            document.cookie = `sidebar-collapsed=${nextCollapsed}; path=/; max-age=31536000; samesite=lax`;
          }}
          className="absolute right-0 top-[3.25rem] z-20 hidden h-5 w-5 translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground md:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeft className="size-3" />
          ) : (
            <PanelLeftClose className="size-3" />
          )}
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-sm md:px-6">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 border-sidebar-border bg-sidebar p-0"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {renderSidebar(false)}
            </SheetContent>
          </Sheet>

          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
            {pageTitle(pathname)}
          </h1>

          <div className="ml-auto flex items-center gap-1">
            {/* Notification bell — wired to real unread count + recent items popover */}
            <Popover>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 relative text-muted-foreground hover:text-foreground"
                        aria-label={
                          unreadCount > 0
                            ? `Notifications (${unreadCount} unread)`
                            : "Notifications"
                        }
                      >
                        <Bell className="size-4" />
                        {unreadCount > 0 ? (
                          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        ) : null}
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {unreadCount > 0
                      ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                      : "Notifications"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-80 p-0"
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-[13px] font-semibold text-foreground">
                    Notifications
                  </span>
                  {unreadCount > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[12px] text-muted-foreground hover:text-foreground"
                      disabled={pending}
                      onClick={handleMarkAll}
                    >
                      {pending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <CheckCheck className="size-3.5" />
                      )}
                      Mark all read
                    </Button>
                  ) : null}
                </div>

                {recentNotifications.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-[13px] text-muted-foreground">
                      You&apos;re all caught up.
                    </p>
                  </div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {recentNotifications.map((n) => {
                      const Icon = notificationIcon(n.type);
                      const isUnread = n.read_at === null;
                      const isBusy = busyId === n.id;
                      const rowClassName = `flex gap-2.5 px-3 py-2.5 transition-colors ${
                        n.link
                          ? "hover:bg-accent/40 cursor-pointer"
                          : ""
                      } ${isUnread ? "bg-primary/[0.03]" : ""}`;
                      const inner = (
                        <>
                          <div
                            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${
                              isUnread
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isBusy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Icon className="size-3.5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium text-foreground">
                              {n.title}
                            </p>
                            {n.body ? (
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                                {n.body}
                              </p>
                            ) : null}
                            <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                              {relativeTime(n.created_at)} ·{" "}
                              {notificationLabel(n.type)}
                            </p>
                          </div>
                        </>
                      );
                      return (
                        <li
                          key={n.id}
                          className="border-b border-border last:border-b-0"
                        >
                          {n.link ? (
                            <a
                              href={n.link}
                              onClick={(e) => handleNotificationClick(n, e)}
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
                )}

                <div className="border-t border-border p-1">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-center text-[12px] text-muted-foreground hover:text-foreground"
                  >
                    <Link href="/notifications">View all</Link>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
