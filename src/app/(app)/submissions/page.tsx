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
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SubmissionStatus } from "@/types/database";

const submissionStatuses: Array<{ value: SubmissionStatus; label: string }> = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "revision_requested", label: "Revision requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default async function MySubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requireActiveMember();
  const params = await searchParams;
  const requestedPage = /^\d+$/.test(params.page ?? "")
    ? Number(params.page)
    : 1;
  const query = (params.q ?? "").trim().slice(0, 100);
  const status = submissionStatuses.some((item) => item.value === params.status)
    ? (params.status as SubmissionStatus)
    : undefined;
  const hasFilters = Boolean(query || status);

  let submissions: Awaited<ReturnType<typeof getMySubmissions>> | null = null;
  let loadError: string | null = null;
  try {
    submissions = await getMySubmissions(requestedPage, { query, status });
  } catch {
    loadError = "Could not load your submissions right now.";
  }
  const rows = submissions?.rows ?? [];
  const pageHref = (page: number) => {
    const search = new URLSearchParams({ page: String(page) });
    if (query) search.set("q", query);
    if (status) search.set("status", status);
    return `/submissions?${search.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="My submissions"
        description="Everything you've submitted, with reviewer feedback and scores."
      />

      <form action="/submissions" method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search assignment titles…"
          aria-label="Search submissions by assignment title"
          className="sm:max-w-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label="Filter submissions by status"
          className="h-9 rounded-md border border-input bg-background px-3 text-[13px] text-foreground"
        >
          <option value="">All statuses</option>
          {submissionStatuses.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <Button type="submit" variant="outline">Filter</Button>
        {hasFilters ? <Button asChild variant="ghost"><Link href="/submissions">Clear</Link></Button> : null}
      </form>

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          {loadError}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
          <Inbox className="size-6 text-muted-foreground" />
          <p className="mt-2 text-[14px] font-medium text-foreground">
            {hasFilters ? "No submissions match these filters." : "You have not submitted any work yet."}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {hasFilters ? "Try changing the assignment search or status." : "Pick an assignment from the list and submit your work."}
          </p>
          {hasFilters ? (
            <Link href="/submissions" className="mt-3 text-[13px] font-medium text-primary hover:underline">Clear filters</Link>
          ) : (
            <Link href="/assignments" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
              Browse assignments
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 text-[13px] text-muted-foreground">
            <span className="nums font-medium text-foreground">{submissions?.total ?? 0}</span>{" "}
            {(submissions?.total ?? 0) === 1 ? "submission" : "submissions"}
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
                {rows.map((s) => {
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
          {submissions && submissions.totalPages > 1 ? (
            <nav className="flex items-center justify-between" aria-label="Submission history pages">
              {submissions.page > 1 ? (
                <Link
                  href={pageHref(submissions.page - 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-[13px] text-foreground hover:bg-accent"
                  rel="prev"
                >
                  <ArrowLeft className="size-4" /> Previous
                </Link>
              ) : <span />}
              <span className="text-[12px] text-muted-foreground">
                Page {submissions.page} of {submissions.totalPages}
              </span>
              {submissions.page < submissions.totalPages ? (
                <Link
                  href={pageHref(submissions.page + 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-[13px] text-foreground hover:bg-accent"
                  rel="next"
                >
                  Next <ArrowRight className="size-4" />
                </Link>
              ) : <span />}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
