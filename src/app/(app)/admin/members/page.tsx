import { redirect } from "next/navigation";
import { requireActiveMember } from "@/features/auth/session";
import { getMembers } from "@/features/members/queries";
import { PageHeader } from "@/components/page-header";
import { MembersTable } from "./members-table";

export default async function AdminMembersPage() {
  const session = await requireActiveMember();
  if (session.membership.role !== "admin" && session.membership.role !== "leader") {
    redirect("/dashboard");
  }

  const members = await getMembers();
  const isAdmin = session.membership.role === "admin";
  const currentUserId = session.userId;

  return (
    <>
      <PageHeader
        title="Members"
        description="Manage the squad roster, approve pending requests, and assign roles."
      />
      <MembersTable
        members={members}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
    </>
  );
}
