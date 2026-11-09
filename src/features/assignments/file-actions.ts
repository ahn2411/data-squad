"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import { SUBMISSION_FILE_TYPES } from "@/features/submissions/schemas";

const attachmentSchema = z.object({
  assignmentId: z.string().uuid(),
  storagePath: z.string().min(1).max(1024),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(SUBMISSION_FILE_TYPES),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});
const deleteSchema = z.object({ fileId: z.string().uuid() });

export type AssignmentFileActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAssignmentManager() {
  if (!isSupabaseConfigured()) return null;
  const ctx = await getSessionContext();
  if (
    ctx.status !== "active" ||
    (ctx.membership.role !== "admin" && ctx.membership.role !== "leader")
  ) return null;
  return { userId: ctx.userId, teamId: ctx.membership.team_id };
}

export async function registerAssignmentFileAction(
  input: unknown,
): Promise<AssignmentFileActionResult> {
  const actor = await requireAssignmentManager();
  if (!actor) return { ok: false, error: "Only active leaders and admins can add assignment files." };

  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid file." };
  const file = parsed.data;
  const prefix = `${actor.teamId}/${actor.userId}/assignments/${file.assignmentId}/`;
  const storedName = file.storagePath.startsWith(prefix)
    ? file.storagePath.slice(prefix.length)
    : "";
  if (!storedName || storedName.includes("/") || !/^[0-9a-f-]{36}-[A-Za-z0-9._-]+$/i.test(storedName)) {
    return { ok: false, error: "The uploaded file path is invalid." };
  }

  const supabase = await createSupabaseServerClient();
  const discard = async () => { await supabase.storage.from("squad-attachments").remove([file.storagePath]); };
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, team_id")
    .eq("id", file.assignmentId)
    .eq("team_id", actor.teamId)
    .maybeSingle();
  if (!assignment) {
    await discard();
    return { ok: false, error: "Assignment not found." };
  }

  const { data: objects, error: listError } = await supabase.storage
    .from("squad-attachments")
    .list(`${actor.teamId}/${actor.userId}/assignments/${file.assignmentId}`, { search: storedName });
  const object = objects?.find((entry) => entry.name === storedName);
  const metadata = object?.metadata as Record<string, unknown> | null | undefined;
  if (
    listError || !object || typeof metadata?.size !== "number" ||
    typeof metadata.mimetype !== "string" || metadata.size !== file.fileSize ||
    metadata.mimetype !== file.contentType
  ) {
    await discard();
    return { ok: false, error: "The uploaded file could not be verified." };
  }

  const { count, error: countError } = await supabase
    .from("assignment_files")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", file.assignmentId);
  if (countError || (count ?? 0) >= 10) {
    await discard();
    return { ok: false, error: countError ? "Could not verify current assignment files." : "An assignment can have at most 10 attached files." };
  }

  const { error } = await supabase.from("assignment_files").insert({
    assignment_id: assignment.id,
    team_id: actor.teamId,
    storage_path: file.storagePath,
    file_name: file.fileName,
    content_type: file.contentType,
    file_size: file.fileSize,
    uploaded_by: actor.userId,
  });
  if (error) {
    await discard();
    return { ok: false, error: "Could not save the assignment attachment." };
  }

  revalidatePath(`/admin/assignments/${assignment.id}/edit`);
  revalidatePath(`/assignments/${assignment.id}`);
  revalidatePath("/assignments");
  return { ok: true };
}

export async function deleteAssignmentFileAction(
  input: unknown,
): Promise<AssignmentFileActionResult> {
  const actor = await requireAssignmentManager();
  if (!actor) return { ok: false, error: "Only active leaders and admins can remove assignment files." };
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid attachment." };

  const supabase = await createSupabaseServerClient();
  const { data: file } = await supabase
    .from("assignment_files")
    .select("id, assignment_id, team_id, storage_path")
    .eq("id", parsed.data.fileId)
    .eq("team_id", actor.teamId)
    .maybeSingle();
  if (!file) return { ok: false, error: "Attachment not found." };

  const { error: deleteError } = await supabase
    .from("assignment_files")
    .delete()
    .eq("id", file.id);
  if (deleteError) return { ok: false, error: "Could not remove the attachment." };

  const { error: storageError } = await supabase.storage
    .from("squad-attachments")
    .remove([file.storage_path]);
  revalidatePath(`/admin/assignments/${file.assignment_id}/edit`);
  revalidatePath(`/assignments/${file.assignment_id}`);
  if (storageError) {
    return { ok: false, error: "Attachment record removed, but the private file could not be deleted. Contact an administrator." };
  }
  return { ok: true };
}
