// Loads .env.local (secrets, git-ignored) then .env (committed demo URL and anon key).
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export function serviceEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY: add it to .env.local (see README).");
    process.exit(1);
  }
  return { url, key };
}
