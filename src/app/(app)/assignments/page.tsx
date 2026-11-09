import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import {
  ASSIGNMENT_PAGE_SIZE,
  getAssignmentsForUser,
} from "@/features/assignments/queries";
import { AssignmentsList, type StatusFilter } from "./assignments-list";

const statusFilters: StatusFilter[] = [
  "all",
  "pending",
  "submitted",
  "approved",
  "overdue",
];

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const session = await requireActiveMember();

  const search = (params.search ?? "").trim().slice(0, 120);
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let result: Awaited<ReturnType<typeof getAssignmentsForUser>> = {
    assignments: [],
    totalCount: 0,
    page: 1,
    pageSize: ASSIGNMENT_PAGE_SIZE,
  };
  let loadError: string | null = null;
  try {
    result = await getAssignmentsForUser(
      {
        search,
        status: statusFilters.includes(params.status as StatusFilter)
          ? (params.status as StatusFilter)
          : "all",
      },
      page,
    );
  } catch {
    loadError = "Could not load assignments right now.";
  }

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Exercises and deliverables assigned to you. Submit work before the deadline."
      />
      <AssignmentsList
        assignments={result.assignments}
        totalCount={result.totalCount}
        page={result.page}
        pageSize={result.pageSize}
        loadError={loadError}
        initialSearch={search}
        initialStatus={
          statusFilters.includes(params.status as StatusFilter)
            ? (params.status as StatusFilter)
            : "all"
        }
      />
    </>
  );
}
