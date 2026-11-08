import { AlertCircle } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { getNotifications } from "@/features/notifications/queries";
import type { Notification } from "@/types/database";
import { NotificationsList } from "./notifications-list";

export default async function NotificationsPage() {
  const session = await requireActiveMember();

  let notifications: Notification[] = [];
  let loadError: string | null = null;
  try {
    notifications = await getNotifications();
  } catch {
    loadError = "Could not load notifications right now.";
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Reviews, announcements, and new assignments — all in one place."
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
      ) : (
        <NotificationsList notifications={notifications} />
      )}
    </>
  );
}
