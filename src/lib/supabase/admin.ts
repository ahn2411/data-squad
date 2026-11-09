import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./configured";

/** Server-only Supabase client for Auth Admin operations. Never import in client modules. */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseConfig.url || !serviceRoleKey) {
    throw new Error("Supabase Auth Admin is not configured.");
  }

  return createClient(supabaseConfig.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
