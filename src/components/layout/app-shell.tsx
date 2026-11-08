"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  PanelLeftClose,
  PanelLeft,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { visibleSectionsFor } from "./sidebar-nav-data";
import type { TeamRole } from "@/types/database";
import { toast } from "sonner";

interface AppShellProps {
  user: {
    name: string | null;
    email: string;
    role: TeamRole;
  };
  initialCollapsed: boolean;
  children: React.ReactNode;
}

/** Map known routes to a top-bar page title (Phase 2 routes only). */
function pageTitle(pathname: string): string {
  switch (pathname) {
    case "/dashboard":
      return "Overview";
    case "/profile":
      return "Profile";
    case "/admin/members":
      return "Members";
    default:
      return "Squad Hub";
  }
}

export function AppShell({ user, initialCollapsed, children }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);

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
          sections={visibleSectionsFor(user.role)}
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
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 relative text-muted-foreground hover:text-foreground"
                    aria-label="Notifications"
                    onClick={() => toast("No new notifications")}
                  >
                    <Bell className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Notifications</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
