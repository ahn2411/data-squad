"use client";

import * as React from "react";
import { Download, FileUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SUBMISSION_FILE_TYPES } from "@/features/submissions/schemas";
import { deleteAssignmentFileAction, registerAssignmentFileAction } from "@/features/assignments/file-actions";
import type { Database } from "@/types/database";

type AssignmentFile = Database["public"]["Tables"]["assignment_files"]["Row"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function AssignmentAttachments({
  assignmentId,
  teamId,
  userId,
  files,
}: {
  assignmentId: string;
  teamId: string;
  userId: string;
  files: AssignmentFile[];
}) {
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const uploadFiles = async (picked: FileList | null) => {
    if (!picked?.length) return;
    if (files.length + picked.length > 10) {
      toast.error("An assignment can have at most 10 files.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    try {
      for (const file of Array.from(picked)) {
        if (!SUBMISSION_FILE_TYPES.includes(file.type as (typeof SUBMISSION_FILE_TYPES)[number])) {
          toast.error(`${file.name}: this file type is not allowed.`);
          continue;
        }
        if (file.size < 1 || file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name}: files must be 10 MB or smaller.`);
          continue;
        }
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-180);
        const objectName = `${crypto.randomUUID()}-${safeName}`;
        const storagePath = `${teamId}/${userId}/assignments/${assignmentId}/${objectName}`;
        const { error: uploadError } = await supabase.storage
          .from("squad-attachments")
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          toast.error(`${file.name}: upload failed.`);
          continue;
        }
        const result = await registerAssignmentFileAction({
          assignmentId,
          storagePath,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        });
        if (!result.ok) {
          toast.error(`${file.name}: ${result.error}`);
          continue;
        }
        toast.success(`${file.name} attached.`);
      }
      window.location.reload();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeFile = async (fileId: string) => {
    setBusy(true);
    try {
      const result = await deleteAssignmentFileAction({ fileId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Attachment removed.");
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async (path: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.storage
      .from("squad-attachments")
      .createSignedUrl(path, 300, { download: true });
    if (error || !data?.signedUrl) {
      toast.error("Could not create a secure download link.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">Assignment files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[12px] text-muted-foreground">
          Attach up to 10 private files. Members assigned to this published assignment can download them. Maximum 10 MB per file.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SUBMISSION_FILE_TYPES.join(",")}
          className="sr-only"
          disabled={busy || files.length >= 10}
          onChange={(event) => void uploadFiles(event.target.files)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || files.length >= 10}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          Add files
        </Button>
        {files.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-2 p-2.5">
                <span className="min-w-0 truncate text-[13px]">{file.file_name}</span>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="icon" variant="ghost" aria-label={`Download ${file.file_name}`} disabled={busy} onClick={() => void downloadFile(file.storage_path)}>
                    <Download className="size-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${file.file_name}`} disabled={busy} onClick={() => void removeFile(file.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-[12px] text-muted-foreground">No files attached.</p>}
      </CardContent>
    </Card>
  );
}
