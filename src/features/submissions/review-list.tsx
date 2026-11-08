import { CheckCircle2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ReviewStatusBadge } from "@/features/assignments/badges";
import { initials, formatDateTime } from "@/lib/format";
import type { Review } from "@/types/database";

interface ReviewListProps {
  reviews: Array<
    Review & {
      reviewer: Pick<{ id: string; full_name: string | null; email: string }, "id" | "full_name" | "email"> | null;
    }
  >;
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) return null;
  const sorted = [...reviews].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-[14px]">
          <CheckCircle2 className="size-4 text-muted-foreground" />
          Reviews & feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sorted.map((review) => {
          const name = review.reviewer?.full_name ?? review.reviewer?.email ?? "Reviewer";
          return (
            <div key={review.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Avatar className="size-7 border border-border">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{name}</p>
                  <p className="nums text-[11px] text-muted-foreground">
                    {formatDateTime(review.created_at)}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {review.score !== null ? (
                    <span className="nums text-[13px] font-semibold text-foreground">
                      {review.score}
                      <span className="text-muted-foreground">/—</span>
                    </span>
                  ) : null}
                  <ReviewStatusBadge status={review.review_status} />
                </div>
              </div>
              {review.feedback ? (
                <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3">
                  <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
                    {review.feedback}
                  </p>
                </div>
              ) : null}
              <Separator />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
