"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";
import { profileSchema, type ProfileValues } from "./schemas";

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string };

/** Update the current user's own profile (editable fields only). */
export async function updateProfileAction(
  values: ProfileValues,
): Promise<ProfileActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const ctx = await getSessionContext();
  if (ctx.status !== "active") {
    return { ok: false, error: "You must be an active member." };
  }

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const avatarPath = parsed.data.avatarPath || null;
  if (avatarPath) {
    const allowedPath = new RegExp(
      `^${ctx.membership.team_id}/${ctx.userId}/avatar\\.(?:jpg|png|webp)$`,
    );
    if (!allowedPath.test(avatarPath)) {
      return { ok: false, error: "Choose a valid profile image before saving." };
    }
    const supabase = await createSupabaseServerClient();
    const folder = `${ctx.membership.team_id}/${ctx.userId}`;
    const { data: objects, error: storageError } = await supabase.storage
      .from("squad-avatars")
      .list(folder, { search: avatarPath.split("/").at(-1) });
    if (storageError || !objects?.some((object) => `${folder}/${object.name}` === avatarPath)) {
      return { ok: false, error: "The uploaded profile image could not be verified." };
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      username: parsed.data.username || null,
      bio: parsed.data.bio || null,
      github_username: parsed.data.githubUsername || null,
      github_profile_url: parsed.data.githubProfileUrl || null,
      capstone_repository_url: parsed.data.capstoneRepositoryUrl || null,
      avatar_url: avatarPath,
      timezone: parsed.data.timezone,
    })
    .eq("id", ctx.userId) // RLS also enforces id = auth.uid()
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That username is already taken." };
    }
    return { ok: false, error: "Could not save the profile." };
  }

  if (!updated) return { ok: false, error: "Could not find your profile to update." };

  revalidatePath("/profile");
  revalidatePath("/github");
  revalidatePath("/dashboard");
  return { ok: true };
}
