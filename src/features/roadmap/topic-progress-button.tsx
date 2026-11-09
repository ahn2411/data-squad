"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Circle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  markTopicStartedAction,
  markTopicCompletedAction,
  resetTopicProgressAction,
} from "./actions";
import type { TopicStatus } from "@/types/database";

interface TopicProgressButtonProps {
  topicId: string;
  /** Current user's status for this topic; null if no progress row yet. */
  status: TopicStatus | null;
  completionCriteria?: string[];
  /** Compact layout for inline use inside a topic card. */
  compact?: boolean;
}

/**
 * Deliberate-action progress toggle. Renders a different primary button
 * depending on the current status. Never auto-marks complete on view.
 *
 * - null / available / locked → "Mark as started" (outline)
 * - in_progress              → "Mark as completed" (primary)
 * - completed                → "Completed" (disabled, with reset link)
 */
export function TopicProgressButton({
  topicId,
  status,
  completionCriteria = [],
  compact = false,
}: TopicProgressButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [showCompletionChecklist, setShowCompletionChecklist] = React.useState(false);
  const [checkedCriteria, setCheckedCriteria] = React.useState<string[]>([]);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMsg: string,
    onDone?: () => void,
  ) => {
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error ?? "Action failed.");
          return;
        }

        toast.success(successMsg);
        onDone?.();
        router.refresh();
      } catch {
        toast.error("Could not update topic progress. Please try again.");
      }
    });
  };

  const size: "sm" | "default" = compact ? "sm" : "default";

  if (status === "completed") {
    return (
      <div className="flex items-center gap-2">
        <Button size={size} disabled className="gap-1.5">
          <Check className="size-4" />
          Completed
        </Button>
        {confirmReset ? (
          <Button
            size={size}
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={pending}
            onClick={() =>
              run(
                () => resetTopicProgressAction(topicId),
                "Progress reset.",
                () => setConfirmReset(false),
              )
            }
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Confirm reset"}
          </Button>
        ) : (
          <Button
            size={size}
            variant="ghost"
            className="text-muted-foreground"
            disabled={pending}
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        )}
      </div>
    );
  }

  if (status === "in_progress") {
    if (completionCriteria.length === 0) {
      return (
        <div className="text-right">
          <Button size={size} disabled variant="outline">Criteria required</Button>
          <p className="mt-1 max-w-56 text-[11px] text-muted-foreground">
            A leader must add completion criteria before this topic can be completed.
          </p>
        </div>
      );
    }
    const allCriteriaChecked = completionCriteria.every((criterion) => checkedCriteria.includes(criterion));
    return (
      <div className="space-y-2">
        {showCompletionChecklist ? (
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-[12px] font-medium text-foreground">Confirm each criterion you have met</p>
            <ul className="space-y-2">
              {completionCriteria.map((criterion, index) => {
                const id = `topic-${topicId}-criterion-${index}`;
                return (
                  <li key={id} className="flex items-start gap-2">
                    <Checkbox
                      id={id}
                      checked={checkedCriteria.includes(criterion)}
                      onCheckedChange={(checked) => setCheckedCriteria((current) =>
                        checked
                          ? current.includes(criterion) ? current : [...current, criterion]
                          : current.filter((item) => item !== criterion),
                      )}
                    />
                    <label htmlFor={id} className="cursor-pointer text-[12px] leading-relaxed text-foreground">
                      {criterion}
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                size={size}
                disabled={pending || !allCriteriaChecked}
                onClick={() => run(
                  () => markTopicCompletedAction(topicId, checkedCriteria),
                  "Topic marked complete.",
                  () => { setShowCompletionChecklist(false); setCheckedCriteria([]); },
                )}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Confirm completion
              </Button>
              <Button size={size} variant="ghost" disabled={pending} onClick={() => setShowCompletionChecklist(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size={size} disabled={pending} onClick={() => setShowCompletionChecklist(true)}>
            <Check className="size-4" /> Mark as completed
          </Button>
        )}
      </div>
    );
  }

  // null / available / locked → allow starting (locked is informational; user
  // can still begin if they choose to).
  return (
    <Button
      size={size}
      variant="outline"
      disabled={pending}
      onClick={() => run(() => markTopicStartedAction(topicId), "Topic started.")}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Circle className="size-4" />}
      Mark as started
    </Button>
  );
}
