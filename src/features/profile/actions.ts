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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      username: parsed.data.username || null,
      bio: parsed.data.bio || null,
      github_username: parsed.data.githubUsername || null,
      github_profile_url: parsed.data.githubProfileUrl || null,
      timezone: parsed.data.timezone,
    })
    .eq("id", ctx.userId); // RLS also enforces id = auth.uid()

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That username is already taken." };
    }
    return { ok: false, error: "Could not save the profile." };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
