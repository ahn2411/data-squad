"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { saveWeekDeliverablesAction } from "./actions";

export function WeekDeliverablesChecklist({
  weekId,
  deliverables,
  criteria,
  initiallyCompleted,
  initiallyCompletedCriteria,
}: {
  weekId: string;
  deliverables: string[];
  criteria: string[];
  initiallyCompleted: string[];
  initiallyCompletedCriteria: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>(initiallyCompleted);
  const [selectedCriteria, setSelectedCriteria] = React.useState<string[]>(initiallyCompletedCriteria);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        const result = await saveWeekDeliverablesAction(weekId, selected, selectedCriteria);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Weekly deliverable progress saved.");
        router.refresh();
      } catch {
        toast.error("Could not save weekly progress. Please try again.");
      }
    });
  }

  if (deliverables.length === 0 && criteria.length === 0) return null;

  return (
    <div className="mt-2 space-y-3">
      {deliverables.length > 0 ? <ul className="space-y-2">
        {deliverables.map((deliverable) => {
          const checked = selected.includes(deliverable);
          return (
            <li key={deliverable}>
              <label className="flex cursor-pointer items-start gap-2 text-[13px] leading-relaxed text-foreground">
                <Checkbox
                  className="mt-0.5"
                  checked={checked}
                  disabled={pending}
                  onCheckedChange={(value) => setSelected((current) => value
                    ? [...current, deliverable]
                    : current.filter((item) => item !== deliverable))}
                />
                <span>{deliverable}</span>
              </label>
            </li>
          );
        })}
      </ul> : null}
      {criteria.length > 0 ? <div className="space-y-2">
        <p className="text-[12px] font-medium text-foreground">Completion criteria</p>
        {criteria.map((criterion) => {
          const checked = selectedCriteria.includes(criterion);
          return <label key={criterion} className="flex cursor-pointer items-start gap-2 text-[13px] leading-relaxed text-foreground">
            <Checkbox className="mt-0.5" checked={checked} disabled={pending} onCheckedChange={(value) => setSelectedCriteria((current) => value ? [...current, criterion] : current.filter((item) => item !== criterion))} />
            <span>{criterion}</span>
          </label>;
        })}
      </div> : null}
      <Button size="sm" variant="outline" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Save deliverable progress
      </Button>
    </div>
  );
}
