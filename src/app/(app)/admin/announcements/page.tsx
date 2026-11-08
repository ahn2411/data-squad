import { redirect } from "next/navigation";
import { Plus, Megaphone } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  getAdminAnnouncements,
  type AnnouncementWithAuthor,
} from "@/features/announcements/queries";
import { AdminAnnouncementsTable } from "./admin-announcements-table";
import { AnnouncementForm } from "./announcement-form";

export default async function AdminAnnouncementsPage() {
  const session = await requireActiveMember();
  if (
    session.membership.role !== "admin" &&
    session.membership.role !== "leader"
  ) {
    redirect("/dashboard");
  }

  let announcements: AnnouncementWithAuthor[] = [];
  let loadError: string | null = null;
  try {
    announcements = await getAdminAnnouncements();
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
        <AdminAnnouncementsTable announcements={announcements} />
      )}
    </>
  );
}
