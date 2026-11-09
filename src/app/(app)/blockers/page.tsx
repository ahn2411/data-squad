import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import {
  BLOCKER_PAGE_SIZE,
  getMyBlockers,
  getAllBlockers,
  type BlockerWithMeta,
} from "@/features/blockers/queries";
import { BlockersList } from "./blockers-list";
import { AdminBlockersTable } from "./admin-blockers-table";
import { BlockerCreateForm } from "./blocker-create-form";

export default async function BlockersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; priority?: string; page?: string }>;
}) {
  const params = await searchParams;
  const session = await requireActiveMember();
  const isAdminOrLeader =
    session.membership.role === "admin" ||
    session.membership.role === "leader";

  const statuses = ["all", "open", "being_addressed", "resolved", "closed"] as const;
  const priorities = ["all", "low", "medium", "high", "critical"] as const;
  const status = statuses.includes(params.status as (typeof statuses)[number])
    ? (params.status as (typeof statuses)[number])
    : "all";
  const priority = priorities.includes(params.priority as (typeof priorities)[number])
    ? (params.priority as (typeof priorities)[number])
    : "all";
  const search = (params.search ?? "").trim().slice(0, 120);
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let myBlockers: BlockerWithMeta[] = [];
  let teamBlockers: BlockerWithMeta[] = [];
  let totalCount = 0;
  let currentPage = 1;
  let pageSize = BLOCKER_PAGE_SIZE;
  let openCount = 0;
  let loadError: string | null = null;

  try {
    if (isAdminOrLeader) {
      const result = await getAllBlockers({ status, priority, search }, page);
      teamBlockers = result.blockers;
      totalCount = result.totalCount;
      currentPage = result.page;
      pageSize = result.pageSize;
      openCount = result.openCount;
    } else {
      const result = await getMyBlockers({ status, priority, search }, page);
      myBlockers = result.blockers;
      totalCount = result.totalCount;
      currentPage = result.page;
      pageSize = result.pageSize;
    }
  } catch {
    loadError = "Could not load blockers right now.";
  }

  return (
    <>
      <PageHeader
        title="Blockers"
        description="Track what's slowing you down and get unblocked faster."
        action={<BlockerCreateForm />}
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          {loadError}
        </div>
      ) : isAdminOrLeader ? (
        <AdminBlockersTable
          blockers={teamBlockers}
          totalCount={totalCount}
          page={currentPage}
          pageSize={pageSize}
          openCount={openCount}
          initialSearch={search}
          initialStatus={status}
          initialPriority={priority}
        />
      ) : (
        <BlockersList
          blockers={myBlockers}
          totalCount={totalCount}
          page={currentPage}
          pageSize={pageSize}
          initialSearch={search}
          initialStatus={status}
          initialPriority={priority}
        />
      )}
    </>
  );
}
