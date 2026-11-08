"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  createThreadSchema,
  type CreateThreadValues,
  type DiscussionCategory,
} from "@/features/discussions/schemas";
import { createThreadAction } from "@/features/discussions/actions";

interface NewThreadDialogProps {
  categories: readonly DiscussionCategory[];
  trigger?: React.ReactNode;
}

export function NewThreadDialog({
  categories,
  trigger,
}: NewThreadDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = React.useState(false);

  const form = useForm<CreateThreadValues>({
    resolver: zodResolver(createThreadSchema),
    defaultValues: {
      title: "",
      category: "General",
    },
  });

  const onSubmit = (values: CreateThreadValues) => {
    startTransition(async () => {
      const res = await createThreadAction(values);
      if (res.ok) {
        toast.success("Discussion created.");
        form.reset({ title: "", category: "General" });
        setOpen(false);
        if (res.redirectTo) {
          router.push(res.redirectTo);
        }
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const defaultTrigger = (
    <button className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
      <MessageSquarePlus className="size-4" />
      New discussion
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a discussion</DialogTitle>
          <DialogDescription>
            Pick a category and write a short title. You can add the first post
            on the next screen.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Title</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9"
                      placeholder="e.g. How do you handle missing values in pandas?"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[12px]">
                    {field.value.length}/160
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Category</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(v as DiscussionCategory)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-9" disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Create discussion"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
