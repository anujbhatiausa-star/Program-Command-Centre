// Seeds (or re-seeds) the sample data. Safe to run any number of times.
// Usage: node scripts/seed.mjs   (reads .env.local; needs the service-role key)
import { createClient } from "@supabase/supabase-js";
import { tsImport } from "tsx/esm/api";
import { serviceEnv } from "./env.mjs";

const { url, key } = serviceEnv();
const { runSeed } = await tsImport("../lib/seed.ts", import.meta.url);
const admin = createClient(url, key, { auth: { persistSession: false } });

const counts = await runSeed(admin);
console.log("Seeded sample data:");
console.table(counts);
