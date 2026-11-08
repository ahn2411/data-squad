"use client";

import * as React from "react";
import Link from "next/link";
import {
  TriangleAlert,
  ArrowRight,
  Search,
  AlertCircle,
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
  BlockerStatusBadge,
  BlockerPriorityBadge,
} from "@/features/collaboration/badges";
import { formatDate, relativeTime } from "@/lib/format";
import type { BlockerWithMeta } from "@/features/blockers/queries";
import type { BlockerStatus, BlockerPriority } from "@/types/database";

interface BlockersListProps {
  blockers: BlockerWithMeta[];
}

type StatusFilter = "all" | BlockerStatus;
type PriorityFilter = "all" | BlockerPriority;

export function BlockersList({ blockers }: BlockersListProps) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [priority, setPriority] = React.useState<PriorityFilter>("all");

  const filtered = React.useMemo(() => {
    let rows = blockers;
    if (status !== "all") {
      rows = rows.filter((b) => b.status === status);
    }
    if (priority !== "all") {
      rows = rows.filter((b) => b.priority === priority);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.description ?? "").toLowerCase().includes(q) ||
          (b.error_messages ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [blockers, search, status, priority]);

  if (blockers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
        <TriangleAlert className="size-6 text-muted-foreground" />
        <p className="mt-2 text-[14px] font-medium text-foreground">
          No blockers reported
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Hit &quot;Report a blocker&quot; the moment you get stuck — a leader
          will be notified and can help.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your blockers…"
            className="h-9 pl-9"
            aria-label="Search blockers"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger size="sm" className="h-9 w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="being_addressed">Being addressed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as PriorityFilter)}>
            <SelectTrigger size="sm" className="h-9 w-[140px]" aria-label="Filter by priority">
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
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[260px]">Title</TableHead>
              <TableHead className="w-[120px]">Priority</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[120px]">Reported</TableHead>
              <TableHead className="w-[80px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-8 text-center">
                  <p className="text-[13px] text-muted-foreground">
                    No blockers match these filters.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => {
                const name = b.reporter?.full_name ?? b.reporter?.email ?? "You";
                return (
                  <TableRow key={b.id} className="group cursor-pointer">
                    <TableCell className="min-w-[260px]">
                      <Link
                        href={`/blockers/${b.id}`}
                        className="block"
                        aria-label={`Open ${b.title}`}
                      >
                        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                          {b.status === "resolved" ? null : (
                            <AlertCircle className="size-3.5 shrink-0 text-warning" />
                          )}
                          <span className="truncate">{b.title}</span>
                        </div>
                        {b.description ? (
                          <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
                            {b.description}
                          </p>
                        ) : null}
                        {b.helper ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Helper:{" "}
                            <span className="font-medium text-foreground">
                              {b.helper.full_name ?? b.helper.email}
                            </span>
                          </p>
                        ) : null}
                      </Link>
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

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="nums font-medium text-foreground">{filtered.length}</span>
        {filtered.length === 1 ? "blocker" : "blockers"}
      </div>
    </div>
  );
}
