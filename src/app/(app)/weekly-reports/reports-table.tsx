"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Search,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { formatDate, initials } from "@/lib/format";
import type { ReportWithProfile, WeekWithPhaseLite } from "@/features/reports/queries";

interface ReportsTableProps {
  reports: ReportWithProfile[];
  weeks: WeekWithPhaseLite[];
  members: Array<{ id: string; name: string; email: string }>;
  weekFilter?: string;
  userFilter?: string;
}

export function ReportsTable({
  reports,
  weeks,
  members,
  weekFilter,
  userFilter,
}: ReportsTableProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");

  // Sync filters to the URL query so refresh + share work.
  const updateQuery = React.useCallback(
    (next: { week?: string; user?: string }) => {
      const sp = new URLSearchParams();
      if (next.week) sp.set("week", next.week);
      if (next.user) sp.set("user", next.user);
      const qs = sp.toString();
      router.replace(qs ? `/weekly-reports?${qs}` : "/weekly-reports", {
        scroll: false,
      });
    },
    [router],
  );

  const onWeekChange = (value: string) => {
    updateQuery({
      week: value === "all" ? undefined : value,
      user: userFilter,
    });
  };
  const onUserChange = (value: string) => {
    updateQuery({
      week: weekFilter,
      user: value === "all" ? undefined : value,
    });
  };

  const filtered = React.useMemo(() => {
    let rows = reports;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.profiles?.full_name ?? "").toLowerCase().includes(q) ||
          (r.profiles?.email ?? "").toLowerCase().includes(q) ||
          (r.weeks?.title ?? "").toLowerCase().includes(q) ||
          (r.learned ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [reports, search]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by member, week, or content…"
            className="h-9 pl-9"
            aria-label="Search reports"
          />
        </div>
        <Select
          value={weekFilter ?? "all"}
          onValueChange={onWeekChange}
        >
          <SelectTrigger size="sm" className="h-9 w-[200px]" aria-label="Filter by week">
            <SelectValue placeholder="All weeks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All weeks</SelectItem>
            {weeks.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                W{w.week_number} · {w.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={userFilter ?? "all"}
          onValueChange={onUserChange}
        >
          <SelectTrigger size="sm" className="h-9 w-[200px]" aria-label="Filter by member">
            <SelectValue placeholder="All members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
          <FileText className="size-6 text-muted-foreground" />
          <p className="mt-2 text-[14px] font-medium text-foreground">
            No reports match these filters.
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Try clearing the week or member filter, or wait for members to submit.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[220px]">Member</TableHead>
                <TableHead className="min-w-[180px]">Week</TableHead>
                <TableHead className="w-[100px]">Hours</TableHead>
                <TableHead className="w-[140px]">Submitted</TableHead>
                <TableHead className="w-[120px]">Feedback</TableHead>
                <TableHead className="w-[44px] text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((report) => {
                const name =
                  report.profiles?.full_name ?? report.profiles?.email ?? "Member";
                const email = report.profiles?.email ?? "";
                const weekTitle = report.weeks
                  ? `W${report.weeks.week_number} · ${report.weeks.title}`
                  : "—";
                return (
                  <TableRow key={report.id} className="group">
                    <TableCell className="min-w-[220px]">
                      <Link
                        href={`/weekly-reports/${report.week_id}?user=${report.user_id}`}
                        className="flex items-center gap-3"
                      >
                        <Avatar className="size-8 border border-border">
                          <AvatarFallback className="bg-primary/10 text-[11px] font-medium text-primary">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-foreground">
                            {name}
                          </div>
                          <p className="truncate text-[12px] text-muted-foreground">
                            {email}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-[13px] text-foreground">
                        {weekTitle}
                      </span>
                    </TableCell>
                    <TableCell className="nums text-[13px] text-muted-foreground">
                      {report.hours_spent}h
                    </TableCell>
                    <TableCell className="nums text-[13px] text-muted-foreground">
                      {formatDate(report.submitted_at)}
                    </TableCell>
                    <TableCell>
                      {report.leader_feedback ? (
                        <Badge variant="outline" className="text-[11px] font-normal text-success">
                          <CheckCircle2 className="size-3" />
                          Given
                        </Badge>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/weekly-reports/${report.week_id}?user=${report.user_id}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label={`View ${name}'s report`}
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
      )}

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="nums font-medium text-foreground">{filtered.length}</span>
        {filtered.length === 1 ? "report" : "reports"}
      </div>
    </div>
  );
}
