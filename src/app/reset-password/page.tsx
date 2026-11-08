import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  const configured = isSupabaseConfigured();
  return (
    <AuthShell
      title="Set a new password"
      description="Choose a new password for your account."
      notConfigured={!configured}
    >
      <ResetForm />
    </AuthShell>
  );
}
