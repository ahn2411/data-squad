import { History, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LateBadge } from "@/features/assignments/badges";
import { formatDateTime } from "@/lib/format";
import type { SubmissionRevisionRow } from "@/features/submissions/types";

interface SubmissionRevisionListProps {
  revisions: SubmissionRevisionRow[];
}

export function SubmissionRevisionList({ revisions }: SubmissionRevisionListProps) {
  if (revisions.length === 0) return null;
  const sorted = [...revisions].sort((a, b) => a.revision_number - b.revision_number);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-[14px]">
          <History className="size-4 text-muted-foreground" />
          Revision history
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {sorted.map((rev) => (
            <li key={rev.id} className="relative pl-5">
              <span
                className="absolute left-1.5 top-1.5 size-2 rounded-full bg-primary"
                aria-hidden="true"
              />
              <span className="absolute left-[7px] top-3 h-full w-px bg-border" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
                  v{rev.revision_number}
                </Badge>
                <span className="flex items-center gap-1 nums text-[12px] text-muted-foreground">
                  <Clock className="size-3" />
                  {formatDateTime(rev.submitted_at)}
                </span>
                {rev.is_late ? <LateBadge /> : null}
              </div>
              {rev.submission_url ? (
                <a
                  href={rev.submission_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 block text-[13px] text-primary underline-offset-2 hover:underline break-all"
                >
                  {rev.submission_url}
                </a>
              ) : null}
              {rev.submission_text ? (
                <pre className="mt-1.5 whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-foreground line-clamp-6">
                  {rev.submission_text}
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
