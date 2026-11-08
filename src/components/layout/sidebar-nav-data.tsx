import type { LucideIcon } from "lucide-react";
import {
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
  Settings,
} from "lucide-react";
import type { TeamRole } from "@/types/database";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Built routes are clickable; unbuilt render muted with a "Soon" tag. */
  built: boolean;
  /** Restrict to roles. Omit for all roles. */
  roles?: Array<TeamRole>;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Full intended information architecture (FR-UI.2 / FR-UI.3). Only items
 * with `built: true` are navigable in this phase; the rest are shown muted
 * so the structure is visible without faking functionality.
 */
export const navSections: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard, built: true },
      { label: "Profile", href: "/profile", icon: User, built: true },
    ],
  },
  {
    title: "Learning",
    items: [
      { label: "Roadmap", href: "/roadmap", icon: Map, built: false },
      { label: "Assignments", href: "/assignments", icon: ClipboardList, built: false },
      { label: "Submissions", href: "/submissions", icon: Inbox, built: false },
      { label: "Weekly reports", href: "/weekly-reports", icon: FileText, built: false },
      { label: "GitHub", href: "/github", icon: GitBranch, built: false },
    ],
  },
  {
    title: "Collaboration",
    items: [
      { label: "Discussions", href: "/discussions", icon: MessageSquare, built: false },
      { label: "Blockers", href: "/blockers", icon: TriangleAlert, built: false },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "Members",
        href: "/admin/members",
        icon: Users,
        built: true,
        roles: ["admin", "leader"],
      },
      {
        label: "Announcements",
        href: "/admin/announcements",
        icon: Megaphone,
        built: false,
        roles: ["admin", "leader"],
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        built: false,
        roles: ["admin"],
      },
    ],
  },
];

/** Filter sections to those the given role can see at all. */
export function visibleSectionsFor(role: TeamRole): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.roles || item.roles.includes(role),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
