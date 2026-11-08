import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AssignmentForm } from "../assignment-form";
import { getMembers } from "@/features/members/queries";
import { getPhasesAndWeeks } from "./queries";

export default async function NewAssignmentPage() {
  const session = await requireActiveMember();
  if (session.membership.role !== "admin" && session.membership.role !== "leader") {
    redirect("/dashboard");
  }

  let members: Awaited<ReturnType<typeof getMembers>> = [];
  let phases: Awaited<ReturnType<typeof getPhasesAndWeeks>> = [];
  let loadError: string | null = null;
  try {
    [members, phases] = await Promise.all([getMembers(), getPhasesAndWeeks()]);
  } catch {
    loadError = "Could not load form data.";
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="New assignment" />
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          {loadError}
        </div>
        <Button asChild variant="outline" size="sm" className="mt-3 h-9">
          <Link href="/admin/assignments">
            <ArrowLeft className="size-4" />
            Back to assignments
          </Link>
        </Button>
      </>
    );
  }

  // Only active members are valid recipients.
  const activeMembers = members.filter((m) => m.membership_status === "active");

  return (
    <>
      <PageHeader
        title="New assignment"
        description="Define the work, choose recipients, and save as a draft or publish."
      />
      <AssignmentForm
        mode="create"
        members={activeMembers.map((m) => ({
          id: m.user_id,
          name: m.profiles?.full_name ?? m.profiles?.email ?? "Unknown",
          email: m.profiles?.email ?? "",
        }))}
        phases={phases}
      />
    </>
  );
}
