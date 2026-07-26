import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for background jobs (the reminder cron). It bypasses RLS
// and can read every family, so it must only ever be used from server-side
// code that has already authenticated the caller — never from a route a
// visitor can reach without a secret.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || url.includes("placeholder")) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
