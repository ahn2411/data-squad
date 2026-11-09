"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PencilLine, Send, ExternalLink, Paperclip, X } from "lucide-react";
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
  submissionContentSchema,
  SUBMISSION_FILE_TYPES,
  type SubmissionContentValues,
} from "@/features/submissions/schemas";
import {
  registerSubmissionFileAction,
  saveSubmissionAction,
  startSubmissionAction,
} from "@/features/submissions/actions";
import type { SubmissionStatus, SubmissionType } from "@/types/database";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface SubmissionFormProps {
  assignmentId: string;
  requiredSubmissionType: SubmissionType | null;
  existingSubmission: {
    id: string;
    status: SubmissionStatus;
    submission_text: string | null;
    submission_url: string | null;
    files: Array<{ file_name: string }>;
  } | null;
  teamId: string;
  userId: string;
}

const EDITABLE: SubmissionStatus[] = [
  "not_started",
  "in_progress",
  "revision_requested",
];

export function SubmissionForm({
  assignmentId,
  requiredSubmissionType,
  existingSubmission,
  teamId,
  userId,
}: SubmissionFormProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);

  // Determine the submission_type field default. If the assignment specifies
  // one, use it; else default to external_url (URL is most common).
  const defaultType: SubmissionType = requiredSubmissionType ?? "external_url";

  const isUrlSubmission =
    defaultType === "github_repo" ||
    defaultType === "github_pr" ||
    defaultType === "github_commit" ||
    defaultType === "external_url";

  const isTextSubmission = defaultType === "written";

  const form = useForm<SubmissionContentValues>({
    resolver: zodResolver(submissionContentSchema),
    defaultValues: {
      submission_type: defaultType,
      submission_text: existingSubmission?.submission_text ?? "",
      submission_url: existingSubmission?.submission_url ?? "",
    },
  });

  // Reset form when the dialog opens.
  React.useEffect(() => {
    if (open) {
      form.reset({
        submission_type: defaultType,
        submission_text: existingSubmission?.submission_text ?? "",
        submission_url: existingSubmission?.submission_url ?? "",
      });
    }
  }, [open, defaultType, existingSubmission, form]);

  const canEdit =
    !existingSubmission || EDITABLE.includes(existingSubmission.status);

  if (existingSubmission && !canEdit) {
    return (
      <Button size="sm" disabled className="h-9">
        <PencilLine className="size-4" />
        Submission locked
      </Button>
    );
  }

  const onSubmit = (values: SubmissionContentValues) => {
    startTransition(async () => {
      try {
        const started = await startSubmissionAction(assignmentId);
        if (!started.ok || !started.submissionId) {
          toast.error(started.ok ? "Could not start the submission." : started.error);
          return;
        }
        const submissionId = started.submissionId;
        if (selectedFiles.length) {
          const supabase = createSupabaseBrowserClient();
          for (const file of selectedFiles) {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "attachment";
            const path = `${teamId}/${userId}/${submissionId}/${crypto.randomUUID()}-${safeName}`;
            const { error: uploadError } = await supabase.storage
              .from("squad-attachments")
              .upload(path, file, { contentType: file.type, cacheControl: "3600" });
            if (uploadError) {
              toast.error("Could not upload a file. Check that the latest Storage migration is installed and retry.");
              return;
            }
            const registered = await registerSubmissionFileAction({
              submissionId,
              storagePath: path,
              fileName: file.name.slice(0, 255),
              contentType: file.type as (typeof SUBMISSION_FILE_TYPES)[number],
              fileSize: file.size,
            });
            if (!registered.ok) {
              await supabase.storage.from("squad-attachments").remove([path]);
              toast.error(registered.error);
              return;
            }
          }
        }
      const res = await saveSubmissionAction(assignmentId, values);
      if (res.ok) {
        toast.success(
          existingSubmission ? "Submission updated." : "Submission sent for review.",
        );
        setOpen(false);
        if (res.redirectTo) router.push(res.redirectTo);
        router.refresh();
      } else {
        toast.error(res.error);
      }
      } catch {
        toast.error("Could not submit your work. Please retry.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9">
          {existingSubmission ? (
            <>
              <PencilLine className="size-4" />
              Edit submission
            </>
          ) : (
            <>
              <Send className="size-4" />
              Submit work
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {existingSubmission ? "Update submission" : "Submit your work"}
          </DialogTitle>
          <DialogDescription>
            {isUrlSubmission
              ? "Paste a link to your work (GitHub repo, PR, or external URL)."
              : isTextSubmission
                ? "Write or paste your answer below."
                : "Add your submission below."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isUrlSubmission || (!isTextSubmission && !isUrlSubmission) ? (
              <FormField
                control={form.control}
                name="submission_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">
                      URL{isUrlSubmission ? " (required)" : ""}
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-9"
                        placeholder="https://github.com/you/repo"
                        {...field}
                      />
                    </FormControl>
                    {field.value ? (
                      <a
                        href={field.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-primary underline-offset-2 hover:underline"
                      >
                        Open in new tab
                        <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {isTextSubmission || (!isTextSubmission && !isUrlSubmission) ? (
              <FormField
                control={form.control}
                name="submission_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">
                      Text{isTextSubmission ? " (required)" : ""}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={8}
                        className="resize-y"
                        placeholder="Write your answer here…"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[12px]">
                      {field.value?.length ?? 0}/20000
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <label htmlFor="submission-files" className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Paperclip className="size-4" />
                Attach files
                <input
                  id="submission-files"
                  type="file"
                  multiple
                  accept={SUBMISSION_FILE_TYPES.join(",")}
                  className="sr-only"
                  disabled={pending}
                  onChange={(event) => {
                    const picked = Array.from(event.currentTarget.files ?? []);
                    const invalid = picked.find((file) => !SUBMISSION_FILE_TYPES.includes(file.type as (typeof SUBMISSION_FILE_TYPES)[number]) || file.size > 10 * 1024 * 1024);
                    if (invalid) {
                      toast.error("Use a supported file type. Each attachment must be 10 MB or smaller.");
                    } else if (picked.length + (existingSubmission?.files.length ?? 0) > 10) {
                      toast.error("A submission can contain at most 10 files.");
                    } else {
                      setSelectedFiles(picked);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {existingSubmission?.files.map((file) => (
                <p key={`existing-${file.file_name}`} className="text-xs text-muted-foreground">Attached: {file.file_name}</p>
              ))}
              {selectedFiles.map((file) => (
                <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{file.name} · {Math.ceil(file.size / 1024)} KB</span>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setSelectedFiles((current) => current.filter((item) => item !== file))}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">PDF, office documents, text/CSV, ZIP, JPG, PNG, or WebP. Up to 10 files, 10 MB each.</p>
            </div>

            {/* submission_type is fixed per assignment; pass it through hidden. */}
            <input
              type="hidden"
              {...form.register("submission_type")}
              value={defaultType}
            />

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
                ) : existingSubmission ? (
                  "Update submission"
                ) : (
                  "Submit"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
