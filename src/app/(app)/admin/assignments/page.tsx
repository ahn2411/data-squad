import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ClipboardList, TriangleAlert } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getAdminAssignments,
  type AdminAssignmentListItem,
} from "@/features/assignments/queries";
import { getReviewQueue } from "@/features/submissions/queries";
import { AdminAssignmentsTable } from "./admin-assignments-table";
import { ReviewQueueTable } from "./review-queue-table";
import type { ReviewQueueItem } from "@/features/submissions/queries";

export default async function AdminAssignmentsPage() {
  const session = await requireActiveMember();
  if (session.membership.role !== "admin" && session.membership.role !== "leader") {
    redirect("/dashboard");
  }

  let assignments: AdminAssignmentListItem[] = [];
  let loadError: string | null = null;
  try {
    assignments = await getAdminAssignments();
  } catch {
    loadError = "Could not load assignments.";
  }

  let reviewQueue: ReviewQueueItem[] = [];
  try {
    reviewQueue = await getReviewQueue();
  } catch {
    reviewQueue = [];
  }

  const pendingReviewCount = reviewQueue.length;

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Create, publish, and review squad assignments and submissions."
        action={
          <Button asChild size="sm" className="h-9">
            <Link href="/admin/assignments/new">
              <Plus className="size-4" />
              New assignment
            </Link>
          </Button>
        }
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          {loadError}
        </div>
      ) : (
        <Tabs defaultValue="assignments">
          <TabsList>
            <TabsTrigger value="assignments" className="gap-1.5">
              <ClipboardList className="size-3.5" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5">
              <TriangleAlert className="size-3.5" />
              Review queue
              {pendingReviewCount > 0 ? (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-warning-foreground">
                  {pendingReviewCount}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="assignments" className="mt-4">
            <AdminAssignmentsTable assignments={assignments} />
          </TabsContent>
          <TabsContent value="reviews" className="mt-4">
            <ReviewQueueTable items={reviewQueue} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
