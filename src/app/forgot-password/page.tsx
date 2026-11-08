import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  const configured = isSupabaseConfigured();
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we'll send a link to reset your password."
      notConfigured={!configured}
      footer={
        <>
          Remembered it?{" "}
          <a href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </a>
        </>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
