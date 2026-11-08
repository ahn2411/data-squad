import { redirect } from "next/navigation";
import { NotConfiguredScreen } from "@/components/not-configured-screen";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getSessionContext } from "@/features/auth/session";

/**
 * Root resolver. Doesn't render UI itself — routes the user to the right
 * place based on configuration, auth, and membership status.
 */
export default async function RootPage() {
  if (!isSupabaseConfigured()) {
    return <NotConfiguredScreen />;
  }

  const ctx = await getSessionContext();

  switch (ctx.status) {
    case "unauthenticated":
      redirect("/login");
    case "active":
      redirect("/dashboard");
    case "no-membership":
    case "pending":
      redirect("/pending-approval");
    case "suspended":
      redirect("/pending-approval?reason=suspended");
    case "removed":
      redirect("/pending-approval?reason=removed");
    case "not-configured":
      return <NotConfiguredScreen />;
  }
}
