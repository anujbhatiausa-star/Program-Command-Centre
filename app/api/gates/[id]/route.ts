import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole(["pm"]);
  if (viewer instanceof NextResponse) return viewer;
  const { id } = await params;
  const { done } = (await req.json().catch(() => ({}))) as { done?: boolean };

  const db = await createClient();
  const { error } = await db.from("release_gates").update({ done: Boolean(done) }).eq("id", id);
  if (error) return dbFail(error);
  return NextResponse.json({ message: done ? "Gate passed" : "Gate reopened" });
}
