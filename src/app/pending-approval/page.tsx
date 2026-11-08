import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock, PauseCircle, XCircle, UserPlus } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { NotConfiguredScreen } from "@/components/not-configured-screen";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";

export const metadata: Metadata = { title: "Awaiting access" };

export default async function PendingApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <NotConfiguredScreen />;
  }

  const ctx = await getSessionContext();
  const { reason } = await searchParams;

  if (ctx.status === "unauthenticated") redirect("/login");
  if (ctx.status === "active") redirect("/dashboard");

  // Determine the message based on the membership bucket.
  const config = (() => {
    switch (ctx.status) {
      case "no-membership":
        return {
          icon: UserPlus,
          title: "Awaiting team approval",
          body: "Your account exists, but an admin hasn't added you to the squad yet. You'll get access once your membership is approved.",
        };
      case "pending":
        return {
          icon: Clock,
          title: "Access pending approval",
          body: "An admin is reviewing your membership. You'll be able to enter the platform once it's approved.",
        };
      case "suspended":
        return {
          icon: PauseCircle,
          title: "Account suspended",
          body: "Your membership has been suspended. Contact an administrator to restore access.",
        };
      case "removed":
        return {
          icon: XCircle,
          title: "Account removed",
          body: "Your membership has been removed from this team. Contact an administrator if this is unexpected.",
        };
      default:
        return {
          icon: Clock,
          title: "Awaiting access",
          body: "Your account is being reviewed.",
        };
    }
  })();

  const Icon = config.icon;
  // The explicit ?reason=suspended/removed takes precedence (e.g. when the
  // session reflects a status but the layout redirected with a reason).
  const title =
    reason === "suspended"
      ? "Account suspended"
      : reason === "removed"
        ? "Account removed"
        : config.title;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <Logo showWordmark />
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <h1 className="text-[15px] font-semibold tracking-tight">
                {title}
              </h1>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {config.body}
            </p>
            {ctx.status === "no-membership" || ctx.status === "pending" ? (
              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground/80">
                Signed in as{" "}
                <span className="text-foreground">{ctx.email}</span>.
              </p>
            ) : null}
            <div className="mt-5 flex justify-end">
              <SignOutButton />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
