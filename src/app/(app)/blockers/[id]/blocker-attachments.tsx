"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SUBMISSION_FILE_TYPES } from "@/features/submissions/schemas";
import { deleteBlockerFileAction, registerBlockerFileAction } from "@/features/blockers/file-actions";
import type { Database } from "@/types/database";

type BlockerFile = Database["public"]["Tables"]["blocker_files"]["Row"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function BlockerAttachments({
  blockerId,
  teamId,
  userId,
  canUpload,
  canManage,
  canRemoveAll,
  files,
}: {
  blockerId: string;
  teamId: string;
  userId: string;
  canUpload: boolean;
  canManage: boolean;
  canRemoveAll: boolean;
  files: BlockerFile[];
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const upload = async (picked: FileList | null) => {
    if (!picked?.length) return;
    if (files.length + picked.length > 10) {
      toast.error("A blocker can have at most 10 attachments.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      for (const file of Array.from(picked)) {
        if (!SUBMISSION_FILE_TYPES.includes(file.type as (typeof SUBMISSION_FILE_TYPES)[number])) {
          toast.error(`${file.name}: this file type is not allowed.`);
          continue;
        }
        if (!file.size || file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name}: files must be 10 MB or smaller.`);
          continue;
        }
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-180);
        const storagePath = `${teamId}/${userId}/blockers/${blockerId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("squad-attachments")
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          toast.error(`${file.name}: upload failed.`);
          continue;
        }
        const result = await registerBlockerFileAction({
          blockerId, storagePath, fileName: file.name, contentType: file.type, fileSize: file.size,
        });
        if (!result.ok) toast.error(`${file.name}: ${result.error}`);
        else toast.success(`${file.name} attached.`);
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async (file: BlockerFile) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.storage.from("squad-attachments")
      .createSignedUrl(file.storage_path, 300, { download: true });
    if (error || !data?.signedUrl) {
      toast.error("Could not create a secure download link.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remove = async (fileId: string) => {
    setBusy(true);
    try {
      const result = await deleteBlockerFileAction({ fileId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Attachment removed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-[14px]">
          <Paperclip className="size-4 text-muted-foreground" /> Attachments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[12px] text-muted-foreground">Private screenshots and files help the team investigate. Up to 10 files, 10 MB each.</p>
        {canUpload ? (
          <>
            <input ref={inputRef} type="file" multiple accept={SUBMISSION_FILE_TYPES.join(",")} className="sr-only" disabled={busy || files.length >= 10} onChange={(event) => void upload(event.target.files)} />
            <Button type="button" size="sm" variant="outline" disabled={busy || files.length >= 10} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} Add files
            </Button>
          </>
        ) : null}
        {files.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-2 p-2.5">
                <span className="min-w-0 truncate text-[13px]">{file.file_name}</span>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="icon" variant="ghost" aria-label={`Download ${file.file_name}`} onClick={() => void download(file)}>
                    <Download className="size-4" />
                  </Button>
                  {(canManage || canRemoveAll || file.uploaded_by === userId) ? (
                    <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${file.file_name}`} disabled={busy} onClick={() => void remove(file.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-[12px] text-muted-foreground">No attachments.</p>}
      </CardContent>
    </Card>
  );
}
