import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = safeNextPath(url.searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth_callback", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_callback", request.url));
  }

  // Invite links are single-use. Promote the invited account to its invited
  // role only after Supabase has authenticated it from the email link.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    try {
      const admin = createSupabaseAdminClient();
      const { data: invitation } = await admin
        .from("invitations")
        .select("id, team_id, role")
        .eq("email", user.email)
        .eq("status", "sent")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invitation) {
        const { error: memberError } = await admin
          .from("team_members")
          .update({ role: invitation.role })
          .eq("team_id", invitation.team_id)
          .eq("user_id", user.id)
          .eq("membership_status", "pending_approval");

        if (!memberError) {
          await admin
            .from("invitations")
            .update({ status: "accepted", accepted_at: new Date().toISOString() })
            .eq("id", invitation.id)
            .eq("status", "sent");
        }
      }
    } catch {
      // Authenticated users still land on the normal approval route if the
      // optional invitation-role finalization is not configured.
    }
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
