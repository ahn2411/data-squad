import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import {
  getMyBlockers,
  getAllBlockers,
  type BlockerWithMeta,
} from "@/features/blockers/queries";
import { BlockersList } from "./blockers-list";
import { AdminBlockersTable } from "./admin-blockers-table";
import { BlockerCreateForm } from "./blocker-create-form";

export default async function BlockersPage() {
  const session = await requireActiveMember();
  const isAdminOrLeader =
    session.membership.role === "admin" ||
    session.membership.role === "leader";

  let myBlockers: BlockerWithMeta[] = [];
  let teamBlockers: BlockerWithMeta[] = [];
  let loadError: string | null = null;

  try {
    if (isAdminOrLeader) {
      teamBlockers = await getAllBlockers();
    } else {
      myBlockers = await getMyBlockers();
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
        <AdminBlockersTable blockers={teamBlockers} />
      ) : (
        <BlockersList blockers={myBlockers} />
      )}
    </>
  );
}
