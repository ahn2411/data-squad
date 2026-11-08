"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  GitBranch,
  Inbox,
  LayoutDashboard,
  Map,
  Megaphone,
  MessageSquare,
  Settings,
  TriangleAlert,
  User,
  Users,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavIconName, NavSection } from "./sidebar-nav-data";

const navIcons: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  User,
  Users,
  Map,
  ClipboardList,
  Inbox,
  FileText,
  GitBranch,
  MessageSquare,
  TriangleAlert,
  Megaphone,
  Bell,
  Settings,
};

interface SidebarNavProps {
  sections: NavSection[];
  collapsed?: boolean;
  /** Called after a nav click — used to close the mobile sheet. */
  onNavigate?: () => void;
}

export function SidebarNav({ sections, collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn("flex flex-col py-4", collapsed ? "gap-3 px-1.5" : "gap-5 px-3")}
      aria-label="Main"
    >
      {sections.map((section) => (
        <div key={section.title} className="min-w-0">
          {!collapsed ? (
            <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </p>
          ) : null}
          <ul className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
            {section.items.map((item) => {
              const active =
                item.built &&
                (pathname === item.href ||
                  pathname.startsWith(item.href + "/"));
              const Icon = navIcons[item.icon];

              if (!item.built) {
                return (
                  <li key={item.href}>
                    <span
                      className={cn(
                        "flex cursor-not-allowed items-center rounded-md py-2 text-[13px] text-muted-foreground/45",
                        collapsed ? "justify-center px-2" : "gap-2.5 px-2.5",
                      )}
                      aria-disabled="true"
                      title={collapsed ? `${item.label} — Available in a later phase` : undefined}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed ? (
                        <>
                          <span className="truncate">{item.label}</span>
                          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                            Soon
                          </span>
                        </>
                      ) : null}
                    </span>
                  </li>
                );
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex min-w-0 items-center rounded-md py-2 text-[13px] font-medium transition-colors duration-150",
                      collapsed ? "justify-center px-2" : "gap-2.5 px-2.5",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    {/* Left active indicator */}
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity duration-150",
                        active ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
