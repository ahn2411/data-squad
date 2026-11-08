"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createAnnouncementSchema,
  PUBLICATION_STATUSES,
  type CreateAnnouncementValues,
  type UpdateAnnouncementValues,
} from "@/features/announcements/schemas";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
} from "@/features/announcements/actions";
import type { PublicationStatus } from "@/types/database";

interface AnnouncementFormProps {
  mode: "create" | "edit";
  announcementId?: string;
  defaults?: {
    title: string;
    content: string;
    pinned: boolean;
    status: PublicationStatus;
  };
  /** When provided, the form renders inside this Dialog (controlled by parent). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

const formSchema = createAnnouncementSchema.extend({
  title: z.string().min(1, "Title is required").max(160),
  content: z.string().max(8000).optional().or(z.literal("")),
  pinned: z.boolean(),
  status: z.enum(PUBLICATION_STATUSES as [PublicationStatus, ...PublicationStatus[]]),
});
type FormValues = z.infer<typeof formSchema>;

export function AnnouncementForm({
  mode,
  announcementId,
  defaults,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: AnnouncementFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (v: boolean) => {
    if (isControlled && onOpenChange) onOpenChange(v);
    else setUncontrolledOpen(v);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: defaults?.title ?? "",
      content: defaults?.content ?? "",
      pinned: defaults?.pinned ?? false,
      status: defaults?.status ?? "draft",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        title: defaults?.title ?? "",
        content: defaults?.content ?? "",
        pinned: defaults?.pinned ?? false,
        status: defaults?.status ?? "draft",
      });
    }
  }, [open, defaults, form]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      if (mode === "create") {
        const payload: CreateAnnouncementValues = {
          title: values.title,
          content: values.content ?? "",
          pinned: values.pinned,
          status: values.status,
        };
        const res = await createAnnouncementAction(payload);
        if (res.ok) {
          toast.success(
            values.status === "published"
              ? "Announcement published. Members have been notified."
              : "Draft saved.",
          );
          setOpen(false);
          if (res.redirectTo) router.push(res.redirectTo);
          router.refresh();
        } else {
          toast.error(res.error);
        }
      } else if (mode === "edit" && announcementId) {
        const payload: UpdateAnnouncementValues = {
          id: announcementId,
          title: values.title,
          content: values.content ?? "",
          pinned: values.pinned,
          status: values.status,
        };
        const res = await updateAnnouncementAction(payload);
        if (res.ok) {
          toast.success(
            values.status === "published"
              ? "Announcement updated."
              : "Draft saved.",
          );
          setOpen(false);
          router.refresh();
        } else {
          toast.error(res.error);
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <>{trigger}</> : null}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New announcement" : "Edit announcement"}
          </DialogTitle>
          <DialogDescription>
            Publishing an announcement notifies every active member of the
            squad automatically.
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
                      placeholder="e.g. Schedule update for week 4"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Content</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={8}
                      className="resize-y"
                      placeholder="Write your message here…"
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) =>
                        field.onChange(v as PublicationStatus)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Save as draft</SelectItem>
                        <SelectItem value="published">
                          Publish now (notify members)
                        </SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[12px]">
                      Publishing sends a notification to every active member.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pinned"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between gap-3 rounded-md border border-border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-[13px]">Pin to top</FormLabel>
                      <FormDescription className="text-[12px]">
                        Pinned announcements appear first.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Pin announcement"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                <X className="size-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : form.watch("status") === "published" ? (
                  <Send className="size-4" />
                ) : (
                  <Save className="size-4" />
                )}
                {form.watch("status") === "published"
                  ? mode === "create"
                    ? "Publish"
                    : "Update"
                  : "Save draft"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
