import { NextResponse } from "next/server";
import { dbFail, fail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole(["pm"]);
  if (viewer instanceof NextResponse) return viewer;
  const { id } = await params;
  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (!["Open", "Mitigating", "Closed"].includes(status ?? "")) return fail("Invalid status");

  const db = await createClient();
  const { error } = await db.from("raid_items").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return dbFail(error);
  return NextResponse.json({ message: "Updated" });
}
