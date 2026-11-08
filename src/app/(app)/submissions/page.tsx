import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AssignmentTypeBadge,
  SubmissionStatusBadge,
  LateBadge,
} from "@/features/assignments/badges";
import { getMySubmissions } from "@/features/submissions/queries";
import { formatDate } from "@/lib/format";
import { ArrowRight } from "lucide-react";

export default async function MySubmissionsPage() {
  const session = await requireActiveMember();

  let submissions: Awaited<ReturnType<typeof getMySubmissions>> = [];
  let loadError: string | null = null;
  try {
    submissions = await getMySubmissions();
  } catch {
    loadError = "Could not load your submissions right now.";
  }

  return (
    <>
      <PageHeader
        title="My submissions"
        description="Everything you've submitted, with reviewer feedback and scores."
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          {loadError}
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
          <Inbox className="size-6 text-muted-foreground" />
          <p className="mt-2 text-[14px] font-medium text-foreground">
            You have not submitted any work yet.
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Pick an assignment from the list and submit your work.
          </p>
          <Link
            href="/assignments"
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
          >
            Browse assignments
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-3 text-[13px] text-muted-foreground">
            <span className="nums font-medium text-foreground">{submissions.length}</span>{" "}
            {submissions.length === 1 ? "submission" : "submissions"}
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[280px]">Assignment</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[120px]">Submitted</TableHead>
                  <TableHead className="w-[80px]">Late</TableHead>
                  <TableHead className="w-[44px] text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => {
                  const a = s.assignments;
                  return (
                    <TableRow key={s.id} className="group">
                      <TableCell className="min-w-[280px]">
                        <Link
                          href={`/submissions/${s.id}`}
                          className="block"
                          aria-label={`Open submission for ${a.title}`}
                        >
                          <div className="text-[13px] font-medium text-foreground">
                            {a.title}
                          </div>
                          {a.deadline ? (
                            <div className="mt-0.5 nums text-[11px] text-muted-foreground">
                              due {formatDate(a.deadline)}
                            </div>
                          ) : null}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <AssignmentTypeBadge type={a.assignment_type} />
                      </TableCell>
                      <TableCell>
                        <SubmissionStatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="nums text-[13px] text-muted-foreground">
                        {formatDate(s.submitted_at)}
                      </TableCell>
                      <TableCell>
                        {s.is_late ? <LateBadge /> : <span className="text-[12px] text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/submissions/${s.id}`}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          aria-label={`Open submission for ${a.title}`}
                        >
                          <ArrowRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
