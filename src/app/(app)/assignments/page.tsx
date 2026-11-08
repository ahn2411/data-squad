import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import {
  getAssignmentsForUser,
  type AssignmentWithMySubmission,
} from "@/features/assignments/queries";
import { AssignmentsList } from "./assignments-list";

export default async function AssignmentsPage() {
  const session = await requireActiveMember();

  let assignments: AssignmentWithMySubmission[] = [];
  let loadError: string | null = null;
  try {
    assignments = await getAssignmentsForUser();
  } catch {
    loadError = "Could not load assignments right now.";
  }

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Exercises and deliverables assigned to you. Submit work before the deadline."
      />
      <AssignmentsList assignments={assignments} loadError={loadError} />
    </>
  );
}
