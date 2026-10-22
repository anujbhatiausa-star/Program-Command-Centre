import { NextResponse } from "next/server";
import { dbFail, fail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Product owner rejects a story with a reason; it goes back to In progress.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole(["product_owner"]);
  if (viewer instanceof NextResponse) return viewer;
  const { id } = await params;
  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
  if (!reason || reason.trim().length < 5) return fail("A rejection needs a reason (at least 5 characters)");

  const db = await createClient();
  const { data, error } = await db
    .from("stories")
    .update({ status: "In progress", rejection_reason: reason.trim() })
    .eq("id", id)
    .eq("status", "Ready for acceptance")
    .select("key")
    .maybeSingle();
  if (error) return dbFail(error);
  if (!data) return fail("Story is not ready for acceptance", 409);
  return NextResponse.json({ message: `${data.key} rejected and sent back to In progress` });
}
