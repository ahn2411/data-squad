"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  TriangleAlert,
  MessageSquare,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BlockerStatusBadge,
  BlockerPriorityBadge,
} from "@/features/collaboration/badges";
import { formatDate, relativeTime, initials } from "@/lib/format";
import type { BlockerWithMeta } from "@/features/blockers/queries";
import type { BlockerStatus, BlockerPriority } from "@/types/database";

interface AdminBlockersTableProps {
  blockers: BlockerWithMeta[];
  totalCount: number;
  page: number;
  pageSize: number;
  openCount: number;
  initialSearch: string;
  initialStatus: StatusFilter;
  initialPriority: PriorityFilter;
}

type StatusFilter = "all" | BlockerStatus;
type PriorityFilter = "all" | BlockerPriority;

export function AdminBlockersTable({
  blockers,
  totalCount,
  page,
  pageSize,
  openCount,
  initialSearch,
  initialStatus,
  initialPriority,
}: AdminBlockersTableProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState<StatusFilter>(initialStatus);
  const [priority, setPriority] = React.useState<PriorityFilter>(initialPriority);

  React.useEffect(() => {
    const syncFromHistory = () => {
      const params = new URLSearchParams(window.location.search);
      const nextStatus = params.get("status");
      const nextPriority = params.get("priority");
      setSearch(params.get("search") ?? "");
      setStatus(nextStatus && ["all", "open", "being_addressed", "resolved", "closed"].includes(nextStatus)
        ? nextStatus as StatusFilter : "all");
      setPriority(nextPriority && ["all", "low", "medium", "high", "critical"].includes(nextPriority)
        ? nextPriority as PriorityFilter : "all");
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  React.useEffect(() => {
    const normalizedSearch = search.trim().slice(0, 120);
    const params = new URLSearchParams();
    if (normalizedSearch) params.set("search", normalizedSearch);
    if (status !== "all") params.set("status", status);
    if (priority !== "all") params.set("priority", priority);
    const current = new URLSearchParams(window.location.search);
    const currentSearch = (current.get("search") ?? "").trim().slice(0, 120);
    const currentStatus = current.get("status") ?? "all";
    const currentPriority = current.get("priority") ?? "all";
    if (currentSearch === normalizedSearch && currentStatus === status && currentPriority === priority) {
      const currentPage = current.get("page");
      if (currentPage) params.set("page", currentPage);
    }
    const query = params.toString();
    router.replace(query ? `/blockers?${query}` : "/blockers", { scroll: false });
  }, [search, status, priority, router]);

  const hasFilters = Boolean(search.trim()) || status !== "all" || priority !== "all";
  if (totalCount === 0 && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
        <TriangleAlert className="size-6 text-muted-foreground" />
        <p className="mt-2 text-[14px] font-medium text-foreground">
          No blockers reported yet
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          When members hit a wall, their blockers will appear here so you can
          jump in and help.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, member, or error text…"
              className="h-9 pl-9"
              aria-label="Search blockers"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger size="sm" className="h-9 w-[160px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="being_addressed">Being addressed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as PriorityFilter)}>
            <SelectTrigger size="sm" className="h-9 w-[160px]" aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-[12px] text-muted-foreground">
          <span className="nums font-medium text-foreground">{totalCount}</span>{" "}
          {totalCount === 1 ? "blocker" : "blockers"}
          {openCount > 0 ? (
            <>
              <span className="text-muted-foreground/50">·</span>{" "}
              <span className="nums font-medium text-warning">{openCount}</span>{" "}
              open
            </>
          ) : null}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[240px]">Blocker</TableHead>
              <TableHead className="min-w-[180px]">Reporter</TableHead>
              <TableHead className="w-[110px]">Priority</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[120px]">Reported</TableHead>
              <TableHead className="w-[100px]">Helper</TableHead>
              <TableHead className="w-[44px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {blockers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-8 text-center">
                  <p className="text-[13px] text-muted-foreground">
                    No blockers match these filters.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              blockers.map((b) => {
                const name = b.reporter?.full_name ?? "Member";
                const commentHint = ""; // count not fetched in list; left blank
                return (
                  <TableRow key={b.id} className="group cursor-pointer">
                    <TableCell className="min-w-[240px]">
                      <Link
                        href={`/blockers/${b.id}`}
                        className="block"
                        aria-label={`Open ${b.title}`}
                      >
                        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                          {b.status === "resolved" || b.status === "closed" ? null : (
                            <TriangleAlert
                              className={
                                b.priority === "critical"
                                  ? "size-3.5 shrink-0 text-destructive"
                                  : "size-3.5 shrink-0 text-warning"
                              }
                            />
                          )}
                          <span className="truncate">{b.title}</span>
                        </div>
                        {b.description ? (
                          <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
                            {b.description}
                          </p>
                        ) : null}
                        {b.topics ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Topic: {b.topics.title}
                          </p>
                        ) : null}
                        {b.assignments ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Assignment: {b.assignments.title}
                          </p>
                        ) : null}
                        {commentHint ? (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MessageSquare className="size-3" />
                            {commentHint}
                          </p>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7 border border-border">
                          <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-foreground">
                            {name}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <BlockerPriorityBadge priority={b.priority} />
                    </TableCell>
                    <TableCell>
                      <BlockerStatusBadge status={b.status} />
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      <span title={formatDate(b.created_at)}>
                        {relativeTime(b.created_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {b.helper ? (
                        <span className="font-medium text-foreground">
                          {b.helper.full_name ?? "Member"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/blockers/${b.id}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label={`Open ${b.title}`}
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
          {Math.min(page * pageSize, totalCount)} of {totalCount} blockers
        </span>
        <div className="flex gap-2">
          {page > 1 ? <Button asChild size="sm" variant="outline"><Link href={adminBlockerPageHref(search, status, priority, page - 1)}>Previous</Link></Button> : null}
          {page * pageSize < totalCount ? <Button asChild size="sm" variant="outline"><Link href={adminBlockerPageHref(search, status, priority, page + 1)}>Next</Link></Button> : null}
        </div>
      </div>
    </div>
  );
}

function adminBlockerPageHref(search: string, status: StatusFilter, priority: PriorityFilter, page: number): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (status !== "all") params.set("status", status);
  if (priority !== "all") params.set("priority", priority);
  params.set("page", String(page));
  return `/blockers?${params.toString()}`;
}
