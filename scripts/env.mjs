// Loads .env.local and returns the Supabase URL and service-role key.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

export function serviceEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  return { url, key };
}
