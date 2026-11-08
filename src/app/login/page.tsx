import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  return (
    <AuthShell
      title="Sign in to Squad Hub"
      description="Enter your credentials to access the learning platform."
      notConfigured={!configured}
      footer={
        <>
          Need an account?{" "}
          <a
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            Request access
          </a>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
