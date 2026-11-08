import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Request access" };

export default function RegisterPage() {
  const configured = isSupabaseConfigured();
  return (
    <AuthShell
      title="Request access"
      description="Register an account. An admin must approve it before you can enter the squad."
      notConfigured={!configured}
      footer={
        <>
          Already have an account?{" "}
          <a href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </a>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
