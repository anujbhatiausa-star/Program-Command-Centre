import { NextResponse } from "next/server";
import { dbFail, fail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const NEXT: Record<string, string> = { Backlog: "In progress", "In progress": "Ready for acceptance" };

// Algoworks delivery team moves a story forward. Acceptance is never possible here.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole(["pm", "ba"]);
  if (viewer instanceof NextResponse) return viewer;
  const { id } = await params;
  const db = await createClient();

  const { data: story } = await db.from("stories").select("key, status, sprint_id").eq("id", id).maybeSingle();
  if (!story) return fail("Story not found", 404);
  const next = NEXT[story.status];
  if (!next) return fail(`A story in ${story.status} cannot be moved from the board`, 409);

  const patch: Record<string, unknown> = { status: next };
  if (!story.sprint_id) {
    const { data: active } = await db.from("sprints").select("id").eq("status", "active").maybeSingle();
    patch.sprint_id = active?.id ?? null;
  }
  const { error } = await db.from("stories").update(patch).eq("id", id).eq("status", story.status);
  if (error) return dbFail(error);
  return NextResponse.json({ message: `${story.key} moved to ${next}` });
}
