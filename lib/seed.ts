// Idempotent seed: wipes and re-inserts all program data with fixed IDs.
// People are upserted (never deleted) so auth profiles stay linked.
// Runs with the service-role client (scripts/seed.mjs and the PM reset route).
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSeed, SEED_TABLES } from "./seed-data";

const KEY_COLUMN: Partial<Record<(typeof SEED_TABLES)[number], string>> = { person_costs: "person_id" };

export async function runSeed(admin: SupabaseClient, today = new Date()) {
  const rows = buildSeed(today);
  const counts: Record<string, number> = {};

  for (const table of [...SEED_TABLES].reverse()) {
    if (table === "people") continue;
    const key = KEY_COLUMN[table] ?? "id";
    const { error } = await admin.from(table).delete().not(key, "is", null);
    if (error) throw new Error(`delete ${table}: ${error.message}`);
  }
  for (const table of SEED_TABLES) {
    const data = rows[table] as Record<string, unknown>[];
    const { error } =
      table === "people"
        ? await admin.from(table).upsert(data, { onConflict: "id" })
        : await admin.from(table).insert(data);
    if (error) throw new Error(`insert ${table}: ${error.message}`);
    counts[table] = data.length;
  }
  return counts;
}
