"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Search,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DifficultyBadge,
  SubmissionStatusBadge,
  OverdueBadge,
} from "@/features/assignments/badges";
import { formatDate } from "@/lib/format";
import type { AssignmentWithMySubmission } from "@/features/assignments/queries";
import type { SubmissionStatus } from "@/types/database";

export type StatusFilter = "all" | "pending" | "submitted" | "approved" | "overdue";

interface AssignmentsListProps {
  assignments: AssignmentWithMySubmission[];
  totalCount: number;
  page: number;
  pageSize: number;
  loadError: string | null;
  initialSearch: string;
  initialStatus: StatusFilter;
}

export function AssignmentsList({
  assignments,
  totalCount,
  page,
  pageSize,
  loadError,
  initialSearch,
  initialStatus,
}: AssignmentsListProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState<StatusFilter>(initialStatus);

  // Restore filters when the user navigates back/forward through history.
  React.useEffect(() => {
    const syncFromHistory = () => {
      const params = new URLSearchParams(window.location.search);
      const nextStatus = params.get("status");
      setSearch(params.get("search") ?? "");
      setStatus(
        nextStatus && ["all", "pending", "submitted", "approved", "overdue"].includes(nextStatus)
          ? (nextStatus as StatusFilter)
          : "all",
      );
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  React.useEffect(() => {
    const sp = new URLSearchParams();
    const normalizedSearch = search.trim().slice(0, 120);
    if (normalizedSearch) sp.set("search", normalizedSearch);
    if (status !== "all") sp.set("status", status);
    const current = new URLSearchParams(window.location.search);
    const currentSearch = (current.get("search") ?? "").trim().slice(0, 120);
    const currentStatus = current.get("status") ?? "all";
    // Preserve the requested page on initial render/history navigation, but
    // restart at page one when the active filters change.
    if (currentSearch === normalizedSearch && currentStatus === status) {
      const currentPage = current.get("page");
      if (currentPage) sp.set("page", currentPage);
    }
    const qs = sp.toString();
    router.replace(qs ? `/assignments?${qs}` : "/assignments", { scroll: false });
  }, [search, status, router]);

  const hasFilters = Boolean(search.trim()) || status !== "all";

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
        <AlertCircle className="size-6 text-destructive" />
        <p className="mt-2 text-[14px] font-medium text-foreground">{loadError}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Try refreshing the page.
        </p>
      </div>
    );
  }

  if (assignments.length === 0 && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
        <ClipboardList className="size-6 text-muted-foreground" />
        <p className="mt-2 text-[14px] font-medium text-foreground">
          No assignments assigned to you yet.
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          New assignments appear here once a leader publishes them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assignments…"
            className="h-9 pl-9"
            aria-label="Search assignments"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger size="sm" className="h-9 w-[160px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[260px]">Title</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead className="w-[120px]">Difficulty</TableHead>
              <TableHead className="w-[140px]">Deadline</TableHead>
              <TableHead className="w-[150px]">My status</TableHead>
              <TableHead className="w-[44px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-8 text-center">
                  <p className="text-[13px] text-muted-foreground">
                    No assignments match these filters.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((a) => {
                const status: SubmissionStatus | null = a.my_submission?.status ?? null;
                return (
                  <TableRow key={a.id} className="group cursor-pointer">
                    <TableCell className="min-w-[260px]">
                      <Link
                        href={`/assignments/${a.id}`}
                        className="block"
                        aria-label={`Open ${a.title}`}
                      >
                        <div className="text-[13px] font-medium text-foreground">
                          {a.title}
                        </div>
                        {a.description ? (
                          <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
                            {a.description}
                          </p>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <AssignmentTypeBadge type={a.assignment_type} />
                    </TableCell>
                    <TableCell>
                      <DifficultyBadge difficulty={a.difficulty} />
                    </TableCell>
                    <TableCell>
                      {a.deadline ? (
                        <div className="flex items-center gap-1.5 nums text-[13px]">
                          <Clock
                            className={
                              a.is_overdue
                                ? "size-3.5 text-destructive"
                                : "size-3.5 text-muted-foreground"
                            }
                          />
                          <span
                            className={
                              a.is_overdue ? "text-destructive font-medium" : "text-muted-foreground"
                            }
                          >
                            {formatDate(a.deadline)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {status ? (
                        <SubmissionStatusBadge status={status} />
                      ) : a.is_overdue ? (
                        <OverdueBadge />
                      ) : (
                        <SubmissionStatusBadge status="not_started" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/assignments/${a.id}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label={`Open ${a.title}`}
                      >
                        <ArrowRight className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
        <span>
          Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}–
          {Math.min(page * pageSize, totalCount)} of {totalCount} assignments
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={assignmentPageHref(search, status, page - 1)}>Previous</Link>
            </Button>
          ) : null}
          {page * pageSize < totalCount ? (
            <Button asChild size="sm" variant="outline">
              <Link href={assignmentPageHref(search, status, page + 1)}>Next</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function assignmentPageHref(search: string, status: StatusFilter, page: number): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (status !== "all") params.set("status", status);
  params.set("page", String(page));
  return `/assignments?${params.toString()}`;
}
