import type { TeamRole } from "@/types/database";

export type NavIconName =
  | "LayoutDashboard"
  | "User"
  | "Users"
  | "Map"
  | "ClipboardList"
  | "Inbox"
  | "FileText"
  | "GitBranch"
  | "MessageSquare"
  | "TriangleAlert"
  | "Megaphone"
  | "Bell"
  | "Settings";

export interface NavItem {
  label: string;
  href: string;
  /** Serializable icon name; SidebarNav resolves it on the client. */
  icon: NavIconName;
  /** Routes rendered in the workspace navigation. */
  built: boolean;
  /** Restrict to roles. Omit for all roles. */
  roles?: Array<TeamRole>;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Full information architecture for the currently implemented routes. */
export const navSections: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { label: "Overview", href: "/dashboard", icon: "LayoutDashboard", built: true },
      { label: "Profile", href: "/profile", icon: "User", built: true },
      { label: "Notifications", href: "/notifications", icon: "Bell", built: true },
    ],
  },
  {
    title: "Learning",
    items: [
      { label: "Roadmap", href: "/roadmap", icon: "Map", built: true },
      { label: "Assignments", href: "/assignments", icon: "ClipboardList", built: true },
      { label: "Submissions", href: "/submissions", icon: "Inbox", built: true },
      { label: "Weekly reports", href: "/weekly-reports", icon: "FileText", built: true },
      { label: "GitHub", href: "/github", icon: "GitBranch", built: true },
    ],
  },
  {
    title: "Collaboration",
    items: [
      { label: "Discussions", href: "/discussions", icon: "MessageSquare", built: true },
      { label: "Blockers", href: "/blockers", icon: "TriangleAlert", built: true },
      { label: "Announcements", href: "/announcements", icon: "Megaphone", built: true },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "Members",
        href: "/admin/members",
        icon: "Users",
        built: true,
        roles: ["admin", "leader"],
      },
      {
        label: "Announcements",
        href: "/admin/announcements",
        icon: "Megaphone",
        built: true,
        roles: ["admin", "leader"],
      },
      {
        label: "Manage assignments",
        href: "/admin/assignments",
        icon: "ClipboardList",
        built: true,
        roles: ["admin", "leader"],
      },
      {
        label: "Manage roadmap",
        href: "/admin/roadmap",
        icon: "Map",
        built: true,
        roles: ["admin", "leader"],
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
