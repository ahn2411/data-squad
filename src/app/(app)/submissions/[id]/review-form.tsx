"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  createReviewSchema,
  type CreateReviewValues,
} from "@/features/submissions/schemas";
import { createReviewAction } from "@/features/submissions/actions";
import type { ReviewStatus } from "@/types/database";

interface ReviewFormProps {
  submissionId: string;
}

export function ReviewForm({ submissionId }: ReviewFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateReviewValues>({
    resolver: zodResolver(createReviewSchema),
    defaultValues: {
      submissionId,
      review_status: "approved",
      score: null,
      feedback: "",
    },
  });

  const onSubmit = (values: CreateReviewValues) => {
    startTransition(async () => {
      const res = await createReviewAction({
        ...values,
        submissionId,
      });
      if (res.ok) {
        toast.success("Review submitted.");
        form.reset({ submissionId, review_status: "approved", score: null, feedback: "" });
        if (res.redirectTo) router.push(res.redirectTo);
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
          <CheckCircle2 className="size-4 text-muted-foreground" />
          Add your review
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="review_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Decision</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as ReviewStatus)}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="Choose a decision" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="revision_requested">Request revisions</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="pending">Mark under review</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-[12px]">
                    Approved → submission locked. Revisions → member can edit again.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="score"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Score (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="h-9 w-32"
                      placeholder="—"
                      value={field.value === null || field.value === undefined ? "" : field.value}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === "" ? null : Number(v));
                      }}
                    />
                  </FormControl>
                  <FormDescription className="text-[12px]">
                    Integer score (0..max). Clamped to assignment max if exceeded.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="feedback"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Feedback</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      className="resize-y"
                      placeholder="What went well, what to improve…"
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

            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Submit review"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
