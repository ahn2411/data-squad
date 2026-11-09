"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateOwnBlockerStateAction } from "@/features/blockers/actions";
import type { BlockerStatus } from "@/types/database";

export function BlockerOwnerControls({
  blockerId,
  status,
}: {
  blockerId: string;
  status: BlockerStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const reopen = status === "closed" || status === "resolved";
  const nextStatus = reopen ? "open" : "closed";

  const update = () => startTransition(async () => {
    const result = await updateOwnBlockerStateAction(blockerId, nextStatus);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(reopen ? "Blocker reopened." : "Blocker closed.");
    router.refresh();
  });

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={update}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : reopen ? <RotateCcw className="size-4" /> : <X className="size-4" />}
      {reopen ? "Reopen request" : "Close request"}
    </Button>
  );
}
