import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { runSeed } from "@/lib/seed";
import { adminClient } from "@/lib/supabase/admin";

// PM-only: restore the sample data. The role is checked with the user's own
// session before the service-role key is used.
export async function POST() {
  const viewer = await requireRole(["pm"]);
  if (viewer instanceof NextResponse) return viewer;
  try {
    await runSeed(adminClient());
    return NextResponse.json({ message: "Demo data reset to its starting state" });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
