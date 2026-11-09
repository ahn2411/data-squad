"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateBlockerStatusSchema,
  BLOCKER_STATUSES,
  type UpdateBlockerStatusValues,
} from "@/features/blockers/schemas";
import { updateBlockerStatusAction } from "@/features/blockers/actions";
import type { BlockerStatus } from "@/types/database";

interface MemberOption {
  id: string;
  name: string;
}

interface BlockerStatusFormProps {
  blockerId: string;
  currentStatus: BlockerStatus;
  currentHelperId: string | null;
  currentResolutionNotes: string | null;
  members: MemberOption[];
  /** When true, the assignee Select shows a "no helper yet" empty option. */
  allowClearHelper?: boolean;
}

const formSchema = updateBlockerStatusSchema.extend({
  status: z.enum(BLOCKER_STATUSES as [BlockerStatus, ...BlockerStatus[]]),
  assignedHelper: z.string().uuid().nullable().optional(),
  resolutionNotes: z.string().max(4000).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof formSchema>;

const UNASSIGNED = "__none__";

export function BlockerStatusForm({
  blockerId,
  currentStatus,
  currentHelperId,
  currentResolutionNotes,
  members,
}: BlockerStatusFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: currentStatus,
      assignedHelper: currentHelperId ?? null,
      resolutionNotes: currentResolutionNotes ?? "",
    },
  });

  // Keep in sync if the parent re-fetches (router.refresh() after submit).
  React.useEffect(() => {
    form.reset({
      status: currentStatus,
      assignedHelper: currentHelperId ?? null,
      resolutionNotes: currentResolutionNotes ?? "",
    });
  }, [currentStatus, currentHelperId, currentResolutionNotes, form]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload: UpdateBlockerStatusValues = {
        status: values.status,
        assignedHelper: values.assignedHelper ?? null,
        resolutionNotes: values.resolutionNotes ?? "",
      };
      const res = await updateBlockerStatusAction(blockerId, payload);
      if (res.ok) {
        toast.success("Blocker updated.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">Manage blocker</CardTitle>
        <CardDescription className="text-[12px]">
          Assign a helper, change status, or capture resolution notes. Members
          see the result here immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as BlockerStatus)}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BLOCKER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedHelper"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">
                      Assigned helper
                    </FormLabel>
                    <Select
                      value={field.value ?? UNASSIGNED}
                      onValueChange={(v) =>
                        field.onChange(v === UNASSIGNED ? null : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="No helper yet" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>
                          No helper yet
                        </SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[12px]">
                      Assigning a helper when the blocker is open will mark it
                      as being addressed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="resolutionNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">
                    Resolution notes{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      className="resize-y"
                      placeholder="What solved it? Anything the member should know for next time?"
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

            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
