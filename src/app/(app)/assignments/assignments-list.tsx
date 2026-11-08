"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Search,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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

interface AssignmentsListProps {
  assignments: AssignmentWithMySubmission[];
  loadError: string | null;
}

type StatusFilter = "all" | "pending" | "submitted" | "approved" | "overdue";

export function AssignmentsList({ assignments, loadError }: AssignmentsListProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  // Sync filters to the URL query so refresh + share work.
  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("search");
    const st = sp.get("status") as StatusFilter | null;
    if (s) setSearch(s);
    if (st && ["all", "pending", "submitted", "approved", "overdue"].includes(st)) {
      setStatus(st);
    }
  }, []);

  React.useEffect(() => {
    const sp = new URLSearchParams();
    if (search) sp.set("search", search);
    if (status !== "all") sp.set("status", status);
    const qs = sp.toString();
    router.replace(qs ? `/assignments?${qs}` : "/assignments", { scroll: false });
  }, [search, status, router]);

  const filtered = React.useMemo(() => {
    let rows = assignments;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.description ?? "").toLowerCase().includes(q),
      );
    }
    switch (status) {
      case "pending":
        rows = rows.filter(
          (a) =>
            !a.my_submission ||
            a.my_submission.status === "not_started" ||
            a.my_submission.status === "in_progress" ||
            a.my_submission.status === "revision_requested",
        );
        break;
      case "submitted":
        rows = rows.filter(
          (a) =>
            a.my_submission?.status === "submitted" ||
            a.my_submission?.status === "under_review",
        );
        break;
      case "approved":
        rows = rows.filter((a) => a.my_submission?.status === "approved");
        break;
      case "overdue":
        rows = rows.filter((a) => a.is_overdue);
        break;
      case "all":
      default:
        break;
    }
    return rows;
  }, [assignments, search, status]);

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

  if (assignments.length === 0) {
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
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-8 text-center">
                  <p className="text-[13px] text-muted-foreground">
                    No assignments match these filters.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => {
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

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="hidden" />
        <span className="nums font-medium text-foreground">{filtered.length}</span>
        {filtered.length === 1 ? "assignment" : "assignments"}
      </div>
    </div>
  );
}
