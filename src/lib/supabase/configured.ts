/**
 * Central read of the public Supabase env vars.
 *
 * Only NEXT_PUBLIC_* values are safe for the browser. The service-role key
 * is NEVER referenced here — it lives only in server-side code paths that
 * read process.env.SUPABASE_SERVICE_ROLE_KEY directly, never re-exported.
 *
 * If either public value is missing, `isSupabaseConfigured` returns false
 * and the UI renders the "Supabase is not configured" screen instead of
 * crashing on a client call with an empty URL.
 */

function readEnv(key: string): string {
  // NEXT_PUBLIC_ vars are inlined by the bundler for the browser and are
  // also readable via process.env on the server.
  const value = process.env[key];
  return value && value.length > 0 ? value : "";
}

export const supabaseConfig = {
  url: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey);
}

/** Throw a typed error if a code path needs Supabase but it isn't wired. */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
    this.name = "SupabaseNotConfiguredError";
  }
}
