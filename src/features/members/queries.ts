import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberWithProfile } from "@/types/database";

/** Fetch all members of the caller's team, with profile data. */
export async function getMembers(): Promise<MemberWithProfile[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("team_members")
    .select(
      "*, profiles(id, email, full_name, username, avatar_url, github_username, created_at)",
    )
    .order("created_at", { ascending: true });

  return (data ?? []) as unknown as MemberWithProfile[];
}
