"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, TriangleAlert, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBlockerSchema,
  BLOCKER_PRIORITIES,
  type CreateBlockerValues,
} from "@/features/blockers/schemas";
import { createBlockerAction } from "@/features/blockers/actions";
import type { BlockerPriority } from "@/types/database";

interface BlockerCreateFormProps {
  /** Optional trigger to render as the dialog opener. Defaults to a primary
   *  "Report a blocker" button. */
  trigger?: React.ReactNode;
  /** Optional pre-selected topic/assignment context (e.g. opened from a
   *  topic detail page). When provided, the topic/assignment is fixed. */
  topicId?: string;
  topicTitle?: string;
  assignmentId?: string;
  assignmentTitle?: string;
}

/**
 * Form schema: drop `.default()` so input & output types match (zodResolver
 * expects TFieldValues = input type).
 */
const formSchema = createBlockerSchema.extend({
  title: z.string().min(1, "Title is required").max(160),
  description: z.string().max(4000).optional().or(z.literal("")),
  errorMessages: z.string().max(8000).optional().or(z.literal("")),
  codeUrl: z.string().max(2048).optional().or(z.literal("")),
  priority: z.enum(BLOCKER_PRIORITIES as [BlockerPriority, ...BlockerPriority[]]),
  topicId: z.string().uuid().nullable().optional(),
  assignmentId: z.string().uuid().nullable().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function BlockerCreateForm({
  trigger,
  topicId,
  topicTitle,
  assignmentId,
  assignmentTitle,
}: BlockerCreateFormProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      errorMessages: "",
      codeUrl: "",
      priority: "medium",
      topicId: topicId ?? null,
      assignmentId: assignmentId ?? null,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        description: "",
        errorMessages: "",
        codeUrl: "",
        priority: "medium",
        topicId: topicId ?? null,
        assignmentId: assignmentId ?? null,
      });
    }
  }, [open, topicId, assignmentId, form]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload: CreateBlockerValues = {
        title: values.title,
        description: values.description ?? "",
        errorMessages: values.errorMessages ?? "",
        codeUrl: values.codeUrl ?? "",
        priority: values.priority,
        topicId: values.topicId ?? null,
        assignmentId: values.assignmentId ?? null,
      };
      const res = await createBlockerAction(payload);
      if (res.ok) {
        toast.success("Blocker reported. A leader will see it.");
        setOpen(false);
        if (res.redirectTo) router.push(res.redirectTo);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const defaultTrigger = (
    <Button size="sm" className="h-9">
      <TriangleAlert className="size-4" />
      Report a blocker
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <TriangleAlert className="size-4 text-warning" />
            Report a blocker
          </DialogTitle>
          <DialogDescription>
            Stuck on something? Describe the issue so a leader can help.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Title</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9"
                      placeholder="e.g. Can't install pandas on M2 mac"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      className="resize-y"
                      placeholder="What are you trying to do, what's the expected vs actual result?"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[12px]">
                    {field.value?.length ?? 0}/4000
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="errorMessages"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">
                    Error messages{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      className="resize-y font-mono text-[12px]"
                      placeholder="Paste the exact error text, stack trace, or shell output…"
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
              <FormField
                control={form.control}
                name="codeUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">
                      Code link{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-9"
                        placeholder="https://github.com/you/repo"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Priority</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) =>
                        field.onChange(v as BlockerPriority)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BLOCKER_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {topicId && topicTitle ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
                Related topic:{" "}
                <span className="font-medium text-foreground">{topicTitle}</span>
              </div>
            ) : null}
            {assignmentId && assignmentTitle ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
                Related assignment:{" "}
                <span className="font-medium text-foreground">
                  {assignmentTitle}
                </span>
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Report blocker
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
