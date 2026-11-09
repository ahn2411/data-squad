import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AssignmentForm } from "../../assignment-form";
import { getMembers } from "@/features/members/queries";
import { getPhasesAndWeeks } from "../../new/queries";
import { getAdminAssignmentDetail } from "@/features/assignments/queries";
import { AssignmentAttachments } from "../../assignment-attachments";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAssignmentPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireActiveMember();
  if (session.membership.role !== "admin" && session.membership.role !== "leader") {
    redirect("/dashboard");
  }

  let detail = null;
  let members: Awaited<ReturnType<typeof getMembers>> = [];
  let phases: Awaited<ReturnType<typeof getPhasesAndWeeks>> = [];
  let loadError: string | null = null;

  try {
    [detail, members, phases] = await Promise.all([
      getAdminAssignmentDetail(id),
      getMembers(),
      getPhasesAndWeeks(),
    ]);
  } catch {
    loadError = "Could not load this assignment.";
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Edit assignment" />
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          {loadError}
        </div>
        <Button asChild variant="outline" size="sm" className="mt-3 h-9">
          <Link href="/admin/assignments">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
      </>
    );
  }

  if (!detail) notFound();

  const activeMembers = members
    .filter((m) => m.membership_status === "active")
    .map((m) => ({
      id: m.user_id,
      name: m.profiles?.full_name ?? "Member",
    }));

  return (
    <>
      <PageHeader
        title="Edit assignment"
        description="Update the work, recipients, or publication status."
      />
      <AssignmentForm
        mode="edit"
        assignment={detail.assignment}
        selectedRecipientIds={detail.recipients}
        members={activeMembers}
        phases={phases}
      />
      <div className="mt-6">
        <AssignmentAttachments
          assignmentId={detail.assignment.id}
          teamId={session.membership.team_id}
          userId={session.userId}
          files={detail.files}
        />
      </div>
    </>
  );
}
