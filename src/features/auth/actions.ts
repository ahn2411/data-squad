"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
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
  | { ok: true; redirectTo?: string }
  | { ok: false; error: string };

function notConfigured(): ActionResult {
  return {
    ok: false,
    error:
      "Supabase is not configured. Set the env variables in .env.local and restart.",
  };
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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
    return { ok: false, error: "Incorrect email or password." };
  }

  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/" };
}

/** Register a new account. Creates a pending profile (no team access yet). */
export async function signUpAction(
  values: RegisterValues,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return notConfigured();

  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    // Supabase returns a generic message; surface it without leaking internals.
    return { ok: false, error: "Could not create the account. " + error.message };
  }

  // With email confirmation off, the user is now signed in but has no
  // team_members row — the root resolver sends them to pending-approval.
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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${siteUrl()}/reset-password` },
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
