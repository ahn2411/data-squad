"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  weeklyReportSchema,
  type WeeklyReportValues,
} from "@/features/reports/schemas";
import { saveReportAction } from "@/features/reports/actions";
import type { WeeklyReport } from "@/types/database";

interface ReportFormProps {
  weekId: string;
  existing: WeeklyReport | null;
  submitted: boolean;
}

/** Convert a string[] to a newline-joined textarea value. */
function arrToText(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return "";
  return arr.join("\n");
}

/** Convert a textarea value to a string[] (one item per non-empty line). */
function textToArr(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMPTY: WeeklyReportValues = {
  learned: "",
  topics_completed: [],
  exercises_completed: [],
  assignments_completed: [],
  hours_spent: 0,
  biggest_achievement: "",
  main_difficulty: "",
  current_blockers: "",
  questions: "",
  next_week_goals: "",
  github_links: [],
};

export function ReportForm({ weekId, existing, submitted }: ReportFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = React.useState(false);

  // We use the array-typed schema directly, but render textareas for the
  // array fields. The textareas are "raw" — we sync them to the array field
  // via setValue on every change.
  const form = useForm<WeeklyReportValues>({
    resolver: zodResolver(weeklyReportSchema),
    defaultValues: existing
      ? {
          learned: existing.learned ?? "",
          topics_completed: existing.topics_completed ?? [],
          exercises_completed: existing.exercises_completed ?? [],
          assignments_completed: existing.assignments_completed ?? [],
          hours_spent: existing.hours_spent,
          biggest_achievement: existing.biggest_achievement ?? "",
          main_difficulty: existing.main_difficulty ?? "",
          current_blockers: existing.current_blockers ?? "",
          questions: existing.questions ?? "",
          next_week_goals: existing.next_week_goals ?? "",
          github_links: existing.github_links ?? [],
        }
      : EMPTY,
  });

  const onSubmit = (values: WeeklyReportValues) => {
    startTransition(async () => {
      const res = await saveReportAction(weekId, values);
      if (res.ok) {
        toast.success(
          submitted ? "Report updated." : "Report submitted.",
        );
        setJustSaved(true);
        router.refresh();
        if (res.redirectTo) {
          // Stay on the same page (we want to show the success state + the
          // read-only leader feedback section if present). router.refresh()
          // re-fetches server data.
        }
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 rounded-xl border border-border bg-card p-6"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold">
            {submitted ? (
              <>
                <CheckCircle2 className="size-4 text-success" />
                Your report
              </>
            ) : (
              "New report"
            )}
          </h2>
          {justSaved ? (
            <span className="text-[12px] text-success">
              Saved — you can keep editing.
            </span>
          ) : null}
        </div>

        <FormField
          control={form.control}
          name="hours_spent"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[13px]">Hours spent this week</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={168}
                  className="h-9 w-32"
                  value={field.value === 0 ? "" : field.value}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v === "" ? 0 : Number(v));
                  }}
                />
              </FormControl>
              <FormDescription className="text-[12px]">
                Total hours across all learning this week (max 168, one decimal).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="learned"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[13px]">What did you learn?</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  className="resize-y"
                  placeholder="Summary of the concepts, techniques, or tools you picked up."
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[12px]">
                {field.value?.length ?? 0}/8000
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <ArrayField
            control={form.control}
            name="topics_completed"
            label="Topics completed"
            placeholder="One topic per line"
            description="List each topic title you finished."
          />
          <ArrayField
            control={form.control}
            name="exercises_completed"
            label="Exercises completed"
            placeholder="One exercise per line"
            description="List each exercise you completed."
          />
        </div>

        <ArrayField
          control={form.control}
          name="assignments_completed"
          label="Assignments completed"
          placeholder="One assignment per line"
          description="Titles or short notes for assignments submitted this week."
        />

        <FormField
          control={form.control}
          name="biggest_achievement"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[13px]">Biggest achievement</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  className="resize-y"
                  placeholder="What are you most proud of this week?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="main_difficulty"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[13px]">Main difficulty</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  className="resize-y"
                  placeholder="What was the hardest part?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="current_blockers"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[13px]">Current blockers</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  className="resize-y"
                  placeholder="Anything blocking your progress right now?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="questions"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[13px]">Questions for the squad</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  className="resize-y"
                  placeholder="Open questions you'd like answered."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="next_week_goals"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[13px]">Next week goals</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  className="resize-y"
                  placeholder="What do you plan to tackle next week?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <ArrayField
          control={form.control}
          name="github_links"
          label="GitHub links"
          placeholder="One URL per line, e.g. https://github.com/you/repo"
          description="Commits, PRs, or repos you worked on this week."
        />

        <div className="flex justify-end gap-2">
          {submitted ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={pending}
              onClick={() => {
                form.reset();
                router.refresh();
              }}
            >
              <RotateCcw className="size-4" />
              Discard changes
            </Button>
          ) : null}
          <Button type="submit" size="sm" className="h-9" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {submitted ? "Save changes" : "Submit report"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ArrayField — renders a textarea bound to a string[] field via join/split.
// ─────────────────────────────────────────────────────────────────────────────

interface ArrayFieldProps {
  control: ReturnType<typeof useForm<WeeklyReportValues>>["control"];
  name: keyof WeeklyReportValues;
  label: string;
  placeholder?: string;
  description?: string;
}

function ArrayField({
  control,
  name,
  label,
  placeholder,
  description,
}: ArrayFieldProps) {
  return (
    <FormField
      control={control}
      name={name as never}
      render={({ field }) => {
        const textValue = Array.isArray(field.value)
          ? arrToText(field.value as string[])
          : String(field.value ?? "");
        return (
          <FormItem>
            <FormLabel className="text-[13px]">{label}</FormLabel>
            <FormControl>
              <Textarea
                rows={3}
                className="resize-y"
                placeholder={placeholder}
                value={textValue}
                onChange={(e) => field.onChange(textToArr(e.target.value))}
              />
            </FormControl>
            {description ? (
              <FormDescription className="text-[12px]">{description}</FormDescription>
            ) : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
