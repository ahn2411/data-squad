import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  requireActiveMember,
  type ActiveSession,
} from "@/features/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { NotConfiguredScreen } from "@/components/not-configured-screen";
import { AppShell } from "@/components/layout/app-shell";
import { visibleSectionsFor } from "@/components/layout/sidebar-nav-data";
import {
  getUnreadCount,
  getRecentNotifications,
} from "@/features/notifications/queries";
import type { Notification } from "@/types/database";

// Slim shape passed to the client shell — strip heavy fields the bell popover
// doesn't need.
type BellNotification = Pick<
  Notification,
  "id" | "type" | "title" | "body" | "link" | "read_at" | "created_at"
>;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return <NotConfiguredScreen />;
  }

  let session: ActiveSession;
  try {
    session = await requireActiveMember();
  } catch {
    // requireActiveMember redirects; this is a type-only safety net.
    redirect("/login");
  }

  const sections = visibleSectionsFor(session.membership.role);
  const profile = session.profile;
  const cookieStore = await cookies();

  // Fetch the unread count + latest 5 notifications for the bell popover.
  // Errors degrade gracefully — the bell just shows no badge / no items.
  let unreadCount = 0;
  let recentNotifications: BellNotification[] = [];
  try {
    unreadCount = await getUnreadCount();
    const recent = await getRecentNotifications(5);
    recentNotifications = recent.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read_at: n.read_at,
      created_at: n.created_at,
    }));
  } catch {
    // leave defaults
  }

  return (
    <AppShell
      sections={sections}
      initialCollapsed={cookieStore.get("sidebar-collapsed")?.value === "true"}
      user={{
        name: profile?.full_name ?? null,
        email: session.email,
        role: session.membership.role,
      }}
      unreadCount={unreadCount}
      recentNotifications={recentNotifications}
    >
      {children}
    </AppShell>
  );
}
