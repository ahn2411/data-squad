"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  MoreHorizontal,
  Loader2,
  PencilLine,
  Send,
  Archive,
  Users,
  Inbox,
  ClipboardList,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AssignmentTypeBadge,
  DifficultyBadge,
  PublicationBadge,
} from "@/features/assignments/badges";
import { formatDate } from "@/lib/format";
import {
  archiveAssignmentAction,
  publishAssignmentAction,
} from "@/features/assignments/actions";
import type { AdminAssignmentListItem } from "@/features/assignments/queries";
import type { PublicationStatus } from "@/types/database";

interface AdminAssignmentsTableProps {
  assignments: AdminAssignmentListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  initialSearch: string;
  initialStatus: StatusFilter;
}

type StatusFilter = "all" | PublicationStatus;

export function AdminAssignmentsTable({
  assignments,
  totalCount,
  page,
  pageSize,
  initialSearch,
  initialStatus,
}: AdminAssignmentsTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState<StatusFilter>(initialStatus);
  const [archiveTarget, setArchiveTarget] = React.useState<AdminAssignmentListItem | null>(null);

  React.useEffect(() => {
    const syncFromHistory = () => {
      const params = new URLSearchParams(window.location.search);
      const nextStatus = params.get("status");
      setSearch(params.get("search") ?? "");
      setStatus(
        nextStatus && ["all", "draft", "published", "archived"].includes(nextStatus)
          ? (nextStatus as StatusFilter)
          : "all",
      );
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  React.useEffect(() => {
    const normalizedSearch = search.trim().slice(0, 120);
    const params = new URLSearchParams();
    if (normalizedSearch) params.set("search", normalizedSearch);
    if (status !== "all") params.set("status", status);
    const current = new URLSearchParams(window.location.search);
    const currentSearch = (current.get("search") ?? "").trim().slice(0, 120);
    const currentStatus = current.get("status") ?? "all";
    if (currentSearch === normalizedSearch && currentStatus === status) {
      const currentPage = current.get("page");
      if (currentPage) params.set("page", currentPage);
    }
    const query = params.toString();
    router.replace(query ? `/admin/assignments?${query}` : "/admin/assignments", { scroll: false });
  }, [search, status, router]);

  const handlePublish = (row: AdminAssignmentListItem) => {
    startTransition(async () => {
      // Publish with current recipients (no change). Use the saved recipients
      // via the empty-array path; recipients are managed on the edit page.
      const res = await publishAssignmentAction({
        assignmentId: row.id,
        recipientUserIds: [],
      });
      if (res.ok) toast.success("Assignment published.");
      else toast.error(res.error);
    });
  };

  const handleArchive = () => {
    if (!archiveTarget) return;
    startTransition(async () => {
      const res = await archiveAssignmentAction({ assignmentId: archiveTarget.id });
      if (res.ok) {
        toast.success("Assignment archived.");
      } else {
        toast.error(res.error);
      }
      setArchiveTarget(null);
    });
  };

  const hasFilters = Boolean(search.trim()) || status !== "all";
  if (totalCount === 0 && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
        <ClipboardList className="size-6 text-muted-foreground" />
        <p className="mt-2 text-[14px] font-medium text-foreground">
          No assignments yet
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Create your first assignment to assign work to the squad.
        </p>
        <Button asChild size="sm" className="mt-3 h-9">
          <Link href="/admin/assignments/new">
            <ClipboardList className="size-4" />
            New assignment
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative flex-1 max-w-md">
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
            <SelectTrigger size="sm" className="h-9 w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-[12px] text-muted-foreground">
          <span className="nums font-medium text-foreground">{totalCount}</span>{" "}
          {totalCount === 1 ? "assignment" : "assignments"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[260px]">Title</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead className="w-[120px]">Difficulty</TableHead>
              <TableHead className="w-[120px]">Deadline</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[100px] text-right">Recipients</TableHead>
              <TableHead className="w-[110px] text-right">Submissions</TableHead>
              <TableHead className="w-[44px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-8 text-center">
                  <p className="text-[13px] text-muted-foreground">
                    No assignments match these filters.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((row) => (
                <TableRow key={row.id} className="group">
                  <TableCell className="min-w-[260px]">
                    <Link
                      href={`/admin/assignments/${row.id}/edit`}
                      className="block"
                      aria-label={`Edit ${row.title}`}
                    >
                      <div className="text-[13px] font-medium text-foreground">
                        {row.title}
                      </div>
                      {row.description ? (
                        <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
                          {row.description}
                        </p>
                      ) : null}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <AssignmentTypeBadge type={row.assignment_type} />
                  </TableCell>
                  <TableCell>
                    <DifficultyBadge difficulty={row.difficulty} />
                  </TableCell>
                  <TableCell className="nums text-[13px] text-muted-foreground">
                    {formatDate(row.deadline)}
                  </TableCell>
                  <TableCell>
                    <PublicationBadge status={row.publication_status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 nums text-[13px] text-muted-foreground">
                      <Users className="size-3.5" />
                      {row.recipient_count === 0 ? "All" : row.recipient_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 nums text-[13px] text-muted-foreground">
                      <Inbox className="size-3.5" />
                      {row.submission_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 opacity-60 group-hover:opacity-100"
                          disabled={pending}
                          aria-label={`Actions for ${row.title}`}
                        >
                          {pending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <MoreHorizontal className="size-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="text-[12px] text-muted-foreground">
                          Manage
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/assignments/${row.id}/edit`}>
                            <PencilLine className="size-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        {row.publication_status !== "published" ? (
                          <DropdownMenuItem onSelect={() => handlePublish(row)}>
                            <Send className="size-4" />
                            Publish
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem asChild>
                          <Link href={`/assignments/${row.id}`}>
                            <ClipboardList className="size-4" />
                            View as member
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setArchiveTarget(row)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Archive className="size-4" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
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
              <Link href={adminAssignmentPageHref(search, status, page - 1)}>Previous</Link>
            </Button>
          ) : null}
          {page * pageSize < totalCount ? (
            <Button asChild size="sm" variant="outline">
              <Link href={adminAssignmentPageHref(search, status, page + 1)}>Next</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          {archiveTarget ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive assignment?</AlertDialogTitle>
                <AlertDialogDescription>
                  &quot;{archiveTarget.title}&quot; will be hidden from the squad.
                  Existing submissions and reviews are preserved. You can restore it
                  by changing the status back to published.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleArchive}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Archive"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function adminAssignmentPageHref(search: string, status: StatusFilter, page: number): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (status !== "all") params.set("status", status);
  params.set("page", String(page));
  return `/admin/assignments?${params.toString()}`;
}
