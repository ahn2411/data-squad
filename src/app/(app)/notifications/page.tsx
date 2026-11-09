import { AlertCircle } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { getNotifications } from "@/features/notifications/queries";
import { NotificationsList } from "./notifications-list";

export const metadata = { title: "Notifications" };

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  await requireActiveMember();
  const params = await searchParams;
  const parsedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0
    ? parsedPage
    : 1;

  let notificationPage: Awaited<ReturnType<typeof getNotifications>> | null = null;
  let loadError: string | null = null;
  try {
    notificationPage = await getNotifications(requestedPage);
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
        <NotificationsList
          notifications={notificationPage?.notifications ?? []}
          unreadCount={notificationPage?.unreadCount ?? 0}
          totalCount={notificationPage?.totalCount ?? 0}
          page={notificationPage?.page ?? 1}
          pageSize={notificationPage?.pageSize ?? 20}
          totalPages={notificationPage?.totalPages ?? 1}
        />
      )}
    </>
  );
}
