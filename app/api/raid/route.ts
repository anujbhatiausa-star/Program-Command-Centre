import { NextResponse } from "next/server";
import { dbFail, fail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const viewer = await requireRole(["pm"]);
  if (viewer instanceof NextResponse) return viewer;
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!b.title || b.title.trim().length < 5 || !b.owner) return fail("Title and owner are required");

  const db = await createClient();
  const { error } = await db.from("raid_items").insert({
    type: b.type,
    title: b.title.trim(),
    severity: b.severity,
    owner: b.owner.trim(),
    exposure: b.exposure || null,
    mitigation: b.mitigation || null,
    status: "Open",
  });
  if (error) return dbFail(error);
  return NextResponse.json({ message: "RAID item added" });
}
