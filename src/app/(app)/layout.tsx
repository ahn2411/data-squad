import { redirect } from "next/navigation";
import {
  requireActiveMember,
  type ActiveSession,
} from "@/features/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { NotConfiguredScreen } from "@/components/not-configured-screen";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return <NotConfiguredScreen />;
  }

  let session: ActiveSession;
  try {
    session = await requireActiveMember();
  } catch {
    // requireActiveMember redirects; this is a type-only safety net.
    redirect("/login");
  }

  const profile = session.profile;

  return (
    <AppShell
      user={{
        name: profile?.full_name ?? null,
        email: session.email,
        role: session.membership.role,
      }}
    >
      {children}
    </AppShell>
  );
}
