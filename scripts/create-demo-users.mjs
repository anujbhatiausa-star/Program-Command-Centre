// Creates the four demo logins (password demo123) and links each to a person.
// Safe to re-run: existing users get their password reset and profile updated.
// Run after scripts/seed.mjs (profiles reference seeded people).
import { createClient } from "@supabase/supabase-js";
import { tsImport } from "tsx/esm/api";
import { serviceEnv } from "./env.mjs";

const PASSWORD = "demo123";
const { url, key } = serviceEnv();
const { DEMO_USERS, personId } = await tsImport("../lib/seed-data.ts", import.meta.url);
const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;

for (const u of DEMO_USERS) {
  let user = list.users.find((x) => x.email === u.email);
  if (user) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    user = data.user;
  }
  const { error } = await admin.from("profiles").upsert(
    { user_id: user.id, email: u.email, role: u.role, org: u.org, person_id: personId(u.person) },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  console.log(`ok  ${u.email.padEnd(24)} role=${u.role}`);
}
console.log(`\nAll demo users use password: ${PASSWORD}`);
