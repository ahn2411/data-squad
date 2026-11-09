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

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const session = await requireActiveMember();
  if (session.membership.role !== "admin" && session.membership.role !== "leader") {
    redirect("/dashboard");
  }

  const statuses = ["all", "draft", "published", "archived"] as const;
  const status = statuses.includes(params.status as (typeof statuses)[number])
    ? (params.status as (typeof statuses)[number])
    : "all";
  const search = (params.search ?? "").trim().slice(0, 120);
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let assignments: AdminAssignmentListItem[] = [];
  let totalAssignmentCount = 0;
  let currentAssignmentPage = 1;
  let assignmentPageSize = 20;
  let loadError: string | null = null;
  try {
    const result = await getAdminAssignments({ status, search }, page);
    assignments = result.assignments;
    totalAssignmentCount = result.totalCount;
    currentAssignmentPage = result.page;
    assignmentPageSize = result.pageSize;
  } catch {
    loadError = "Could not load assignments.";
  }

  let reviewQueue: ReviewQueueItem[] = [];
  try {
    reviewQueue = await getReviewQueue();
  } catch {
    loadError = "Could not load the submission review queue.";
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
            <AdminAssignmentsTable
              assignments={assignments}
              totalCount={totalAssignmentCount}
              page={currentAssignmentPage}
              pageSize={assignmentPageSize}
              initialSearch={search}
              initialStatus={status}
            />
          </TabsContent>
          <TabsContent value="reviews" className="mt-4">
            <ReviewQueueTable items={reviewQueue} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
