"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addLeaderFeedbackAction } from "@/features/reports/actions";

interface LeaderFeedbackFormProps {
  reportId: string;
  defaultFeedback: string;
  memberName: string;
}

export function LeaderFeedbackForm({
  reportId,
  defaultFeedback,
  memberName,
}: LeaderFeedbackFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = React.useState(defaultFeedback);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await addLeaderFeedbackAction(reportId, value);
      if (res.ok) {
        toast.success("Feedback saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-[14px]">
          <MessageSquare className="size-4 text-muted-foreground" />
          Leader feedback
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-[12px] text-muted-foreground">
            Visible to {memberName} on their report. Only leaders and admins
            can edit this field.
          </p>
          <Textarea
            rows={8}
            className="resize-y"
            placeholder="Coaching notes, encouragement, pointers…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={8000}
          />
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">
              {value.length}/8000
            </span>
            <Button type="submit" size="sm" className="h-9" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save feedback
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
