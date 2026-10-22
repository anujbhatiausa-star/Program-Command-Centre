import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/** Service-role client. Bypasses RLS: only for the PM-only reset route. */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}
