import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./configured";

/**
 * Browser Supabase client. Uses the publishable (anon) key only.
 * Callers must guard with `isSupabaseConfigured()` first; this function
 * throws `SupabaseNotConfiguredError`-equivalent if env vars are absent.
 */
export function createSupabaseBrowserClient() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
}
