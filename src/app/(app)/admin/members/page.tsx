import { redirect } from "next/navigation";
import { requireActiveMember } from "@/features/auth/session";
import { getMembers } from "@/features/members/queries";
import { PageHeader } from "@/components/page-header";
import { MembersTable } from "./members-table";
import { InviteMemberDialog } from "./invite-member-dialog";

export default async function AdminMembersPage() {
  const session = await requireActiveMember();
  if (session.membership.role !== "admin" && session.membership.role !== "leader") {
    redirect("/dashboard");
  }

  let members: Awaited<ReturnType<typeof getMembers>> = [];
  let loadError = false;
  try {
    members = await getMembers();
  } catch {
    loadError = true;
  }
  const isAdmin = session.membership.role === "admin";
  const currentUserId = session.userId;

  return (
    <>
      <PageHeader
        title="Members"
        description="Manage the squad roster, approve pending requests, and assign roles."
        action={
          loadError ? undefined : (
            <InviteMemberDialog inviterRole={session.membership.role} />
          )
        }
      />
      {loadError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          Could not load squad members right now. Try refreshing the page.
        </div>
      ) : (
        <MembersTable
          members={members}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
