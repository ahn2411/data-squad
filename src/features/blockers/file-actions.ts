"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import { SUBMISSION_FILE_TYPES } from "@/features/submissions/schemas";

const blockerFileSchema = z.object({
  blockerId: z.string().uuid(),
  storagePath: z.string().min(1).max(1024),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(SUBMISSION_FILE_TYPES),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});
const deleteFileSchema = z.object({ fileId: z.string().uuid() });
export type BlockerFileActionResult = { ok: true } | { ok: false; error: string };

async function getActor() {
  if (!isSupabaseConfigured()) return null;
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return null;
  return { userId: ctx.userId, teamId: ctx.membership.team_id, role: ctx.membership.role };
}

export async function registerBlockerFileAction(input: unknown): Promise<BlockerFileActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "You must be an active member." };
  const parsed = blockerFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid file." };
  const file = parsed.data;
  const prefix = `${actor.teamId}/${actor.userId}/blockers/${file.blockerId}/`;
  const storedName = file.storagePath.startsWith(prefix) ? file.storagePath.slice(prefix.length) : "";
  if (!storedName || storedName.includes("/") || !/^[0-9a-f-]{36}-[A-Za-z0-9._-]+$/i.test(storedName)) {
    return { ok: false, error: "The uploaded file path is invalid." };
  }

  const supabase = await createSupabaseServerClient();
  const discard = async () => { await supabase.storage.from("squad-attachments").remove([file.storagePath]); };
  const { data: blocker } = await supabase.from("blockers")
    .select("id, team_id, user_id")
    .eq("id", file.blockerId).eq("team_id", actor.teamId).maybeSingle();
  const manager = actor.role === "admin" || actor.role === "leader";
  if (!blocker || (blocker.user_id !== actor.userId && !manager)) {
    await discard();
    return { ok: false, error: "You cannot attach a file to this blocker." };
  }

  const folder = `${actor.teamId}/${actor.userId}/blockers/${file.blockerId}`;
  const { data: objects, error: listError } = await supabase.storage.from("squad-attachments")
    .list(folder, { search: storedName });
  const object = objects?.find((entry) => entry.name === storedName);
  const metadata = object?.metadata as Record<string, unknown> | null | undefined;
  if (listError || !object || typeof metadata?.size !== "number" ||
      typeof metadata.mimetype !== "string" || metadata.size !== file.fileSize ||
      metadata.mimetype !== file.contentType) {
    await discard();
    return { ok: false, error: "The uploaded file could not be verified." };
  }

  const { count, error: countError } = await supabase.from("blocker_files")
    .select("id", { count: "exact", head: true }).eq("blocker_id", file.blockerId);
  if (countError || (count ?? 0) >= 10) {
    await discard();
    return { ok: false, error: countError ? "Could not verify existing attachments." : "A blocker can have at most 10 attachments." };
  }

  const { error } = await supabase.from("blocker_files").insert({
    blocker_id: blocker.id, team_id: actor.teamId, storage_path: file.storagePath,
    file_name: file.fileName, content_type: file.contentType,
    file_size: file.fileSize, uploaded_by: actor.userId,
  });
  if (error) {
    await discard();
    return { ok: false, error: "Could not attach the uploaded file." };
  }
  revalidatePath(`/blockers/${blocker.id}`);
  revalidatePath("/blockers");
  return { ok: true };
}

export async function deleteBlockerFileAction(input: unknown): Promise<BlockerFileActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "You must be an active member." };
  const parsed = deleteFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid attachment." };
  const supabase = await createSupabaseServerClient();
  const { data: file } = await supabase.from("blocker_files")
    .select("id, blocker_id, team_id, storage_path, uploaded_by")
    .eq("id", parsed.data.fileId).eq("team_id", actor.teamId).maybeSingle();
  if (!file) return { ok: false, error: "Attachment not found." };
  const manager = actor.role === "admin" || actor.role === "leader";
  const { data: blocker } = await supabase.from("blockers")
    .select("user_id").eq("id", file.blocker_id).eq("team_id", actor.teamId).maybeSingle();
  if (blocker?.user_id !== actor.userId && file.uploaded_by !== actor.userId && !manager) {
    return { ok: false, error: "You can remove only files attached to your blocker or files you uploaded." };
  }

  const { error: storageError } = await supabase.storage.from("squad-attachments").remove([file.storage_path]);
  if (storageError) return { ok: false, error: "Could not remove the private file." };
  const { error } = await supabase.from("blocker_files").delete().eq("id", file.id);
  if (error) return { ok: false, error: "The file was removed but its metadata could not be cleared." };
  revalidatePath(`/blockers/${file.blocker_id}`);
  revalidatePath("/blockers");
  return { ok: true };
}
