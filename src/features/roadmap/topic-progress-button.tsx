"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Circle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  compact = false,
}: TopicProgressButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmReset, setConfirmReset] = React.useState(false);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMsg: string,
    onDone?: () => void,
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(successMsg);
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error ?? "Action failed.");
      }
      onDone?.();
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
    return (
      <Button
        size={size}
        disabled={pending}
        onClick={() => run(() => markTopicCompletedAction(topicId), "Topic marked complete.")}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Mark as completed
      </Button>
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
