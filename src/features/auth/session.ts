import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import type { Profile, TeamMember, Team, MembershipStatus } from "@/types/database";

export type SessionStatus =
  | "not-configured"
  | "unauthenticated"
  | "no-membership"
  | "pending"
  | "suspended"
  | "removed"
  | "active";

export interface ActiveSession {
  status: "active";
  userId: string;
  email: string;
  profile: Profile;
  membership: TeamMember & { teams: Team | null };
}

export interface InactiveSession {
  status: "no-membership" | "pending" | "suspended" | "removed";
  userId: string;
  email: string;
  profile: Profile | null;
  membership: TeamMember | null;
  membershipStatus: MembershipStatus | null;
}

export type SessionContext =
  | { status: "not-configured" }
  | { status: "unauthenticated" }
  | ActiveSession
  | InactiveSession;

/**
 * Resolves the full auth + membership context for the current request.
 * Single source of truth for layout gating and role-based redirects.
 */
export const getSessionContext = cache(
  async function getSessionContext(): Promise<SessionContext> {
    if (!isSupabaseConfigured()) {
      return { status: "not-configured" };
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { status: "unauthenticated" };
    }

    const email = user.email ?? "";

    // These reads are independent; run them concurrently and reuse the result
    // across the layout, page, and notification queries for this render request.
    const [profileResult, membershipResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single(),
      supabase
        .from("team_members")
        .select("*, teams(*)")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const { data: profile } = profileResult;
    const { data: membership } = membershipResult;

    if (!membership) {
      return {
        status: "no-membership",
        userId: user.id,
        email,
        profile,
        membership: null,
        membershipStatus: null,
      };
    }

    const status = membership.membership_status;
    if (status === "active") {
      return {
        status: "active",
        userId: user.id,
        email,
        profile: (profile as Profile) ?? null,
        membership: membership as TeamMember & { teams: Team | null },
      };
    }

    // Map remaining statuses to a coarse gating bucket.
    const bucket: InactiveSession["status"] =
      status === "suspended"
        ? "suspended"
        : status === "removed"
          ? "removed"
          : "pending";

    return {
      status: bucket,
      userId: user.id,
      email,
      profile: (profile as Profile) ?? null,
      membership: membership as TeamMember,
      membershipStatus: status,
    };
  },
);

/**
 * Server-side guard for (app) routes. Redirects inactive users to the right
 * gate screen. Returns an ActiveSession for the layout to consume.
 */
export async function requireActiveMember(): Promise<ActiveSession> {
  const ctx = await getSessionContext();
  switch (ctx.status) {
    case "not-configured":
    case "unauthenticated":
      redirect("/login");
    case "no-membership":
    case "pending":
      redirect("/pending-approval");
    case "suspended":
      redirect("/pending-approval?reason=suspended");
    case "removed":
      redirect("/pending-approval?reason=removed");
    case "active":
      return ctx;
  }
}

/**
 * Guard for admin-only routes. Must be called AFTER requireActiveMember
 * (it assumes an active session).
 */
export function requireRole(
  session: ActiveSession,
  roles: Array<"admin" | "leader">,
): ActiveSession {
  if (!roles.includes(session.membership.role as "admin" | "leader")) {
    redirect("/dashboard");
  }
  return session;
}
