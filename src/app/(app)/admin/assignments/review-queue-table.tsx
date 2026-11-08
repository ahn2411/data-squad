"use client";

import Link from "next/link";
import { Inbox, ArrowRight } from "lucide-react";
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
  AssignmentTypeBadge,
  DifficultyBadge,
  SubmissionStatusBadge,
  LateBadge,
} from "@/features/assignments/badges";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import type { ReviewQueueItem } from "@/features/submissions/queries";

interface ReviewQueueTableProps {
  items: ReviewQueueItem[];
}

export function ReviewQueueTable({ items }: ReviewQueueTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center">
        <Inbox className="size-6 text-muted-foreground" />
        <p className="mt-2 text-[14px] font-medium text-foreground">
          Nothing to review right now.
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Submitted work waiting for a leader review appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[240px]">Member</TableHead>
            <TableHead className="min-w-[220px]">Assignment</TableHead>
            <TableHead className="w-[120px]">Type</TableHead>
            <TableHead className="w-[100px]">Difficulty</TableHead>
            <TableHead className="w-[130px]">Submitted</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[44px] text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s) => {
            const a = s.assignments;
            const name = s.profiles?.full_name ?? s.profiles?.email ?? "Member";
            return (
              <TableRow key={s.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7 border border-border">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                        {initials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[13px] font-medium text-foreground">
                      {name}
                    </span>
                    {s.is_late ? <LateBadge /> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/submissions/${s.id}`}
                    className="text-[13px] font-medium text-foreground hover:underline"
                  >
                    {a.title}
                  </Link>
                  {a.deadline ? (
                    <p className="mt-0.5 nums text-[11px] text-muted-foreground">
                      due {formatDate(a.deadline)}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <AssignmentTypeBadge type={a.assignment_type} />
                </TableCell>
                <TableCell>
                  <DifficultyBadge difficulty={a.difficulty} />
                </TableCell>
                <TableCell className="nums text-[13px] text-muted-foreground">
                  {formatDateTime(s.submitted_at)}
                </TableCell>
                <TableCell>
                  <SubmissionStatusBadge status={s.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/submissions/${s.id}`}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label={`Review submission for ${a.title}`}
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
  );
}
