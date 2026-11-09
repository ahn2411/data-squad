import { redirect } from "next/navigation";
import { Plus, Megaphone } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  getAdminAnnouncements,
  type AnnouncementStatusFilter,
} from "@/features/announcements/queries";
import { AdminAnnouncementsTable } from "./admin-announcements-table";
import { AnnouncementForm } from "./announcement-form";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

export default async function AdminAnnouncementsPage({ searchParams }: PageProps) {
  const session = await requireActiveMember();
  if (
    session.membership.role !== "admin" &&
    session.membership.role !== "leader"
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const status = ["draft", "published", "archived"].includes(params.status ?? "")
    ? params.status as AnnouncementStatusFilter
    : "all";
  const page = typeof params.page === "string" && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  let result: Awaited<ReturnType<typeof getAdminAnnouncements>> = {
    announcements: [], totalCount: 0, page: 1, pageSize: 20,
  };
  let loadError: string | null = null;
  try {
    result = await getAdminAnnouncements({ search, status, page });
  } catch {
    loadError = "Could not load announcements.";
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Post squad-wide updates. Publishing notifies every active member."
        action={
          <AnnouncementForm
            mode="create"
            trigger={
              <Button size="sm" className="h-9">
                <Plus className="size-4" />
                New announcement
              </Button>
            }
          />
        }
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          <span className="inline-flex items-center gap-1.5">
            <Megaphone className="size-4" />
            {loadError}
          </span>
        </div>
      ) : (
        <AdminAnnouncementsTable key={`${search}:${status}`} announcementPage={result} searchFilter={search} statusFilter={status} />
      )}
    </>
  );
}
