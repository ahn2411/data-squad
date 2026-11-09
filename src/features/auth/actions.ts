"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { getAuthCallbackUrl } from "@/lib/auth-redirect";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type LoginValues,
  type RegisterValues,
  type ForgotPasswordValues,
  type ResetPasswordValues,
} from "./schemas";

export type ActionResult =
  | { ok: true; redirectTo?: string; notice?: string }
  | { ok: false; error: string };

function notConfigured(): ActionResult {
  return {
    ok: false,
    error:
      "Supabase is not configured. Set the env variables in .env.local and restart.",
  };
}

/** Sign in with email + password. */
export async function signInAction(
  values: LoginValues,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return notConfigured();

  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (
      error.code === "email_not_confirmed" ||
      error.message.toLowerCase().includes("email not confirmed")
    ) {
      return {
        ok: false,
        error: "Please confirm your email using the link we sent before signing in.",
      };
    }
    return { ok: false, error: "Incorrect email or password." };
  }

  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/" };
}

/** Register an account and request access to the configured team. */
export async function signUpAction(
  values: RegisterValues,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return notConfigured();

  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const emailRedirectTo = getAuthCallbackUrl("/pending-approval");
  if (!emailRedirectTo) {
    return { ok: false, error: "Email confirmation is not configured for this deployment. Contact the administrator." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo,
    },
  });

  if (error) {
    if (
      error.code === "over_email_send_rate_limit" ||
      error.message.toLowerCase().includes("email rate limit exceeded")
    ) {
      return {
        ok: false,
        error:
          "Supabase has reached its email sending limit. Please wait before retrying, or ask the administrator to configure custom SMTP for account emails.",
      };
    }

    // Keep provider/database details out of the public response and avoid
    // exposing whether an account already exists for the submitted email.
    return {
      ok: false,
      error: "Could not create the account. Check your details and try again.",
    };
  }

  // With email confirmation enabled, Supabase creates the account but does
  // not create a session until the user follows the email link.
  if (!data.session) {
    return {
      ok: true,
      redirectTo: "/login",
      notice: "Account created. Check your email to confirm it before signing in.",
    };
  }

  // The database auth trigger creates a pending team membership for the
  // registered user. The root resolver sends that session to pending-approval.
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/" };
}

/** Request a password reset email. */
export async function requestPasswordResetAction(
  values: ForgotPasswordValues,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return notConfigured();

  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const redirectTo = getAuthCallbackUrl("/reset-password");
  if (!redirectTo) {
    return { ok: false, error: "Password reset emails are not configured for this deployment." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo },
  );

  if (error) {
    return { ok: false, error: "Could not send a reset link. Try again." };
  }

  // Always return ok to avoid account enumeration.
  return { ok: true };
}

/** Update the password after clicking the reset link. */
export async function updatePasswordAction(
  values: ResetPasswordValues,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return notConfigured();

  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: "Could not update the password. Try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/dashboard" };
}

/** Sign out and send the user to the login page. */
export async function signOutAction(): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return notConfigured();

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/login" };
}
