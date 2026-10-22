import { NextResponse } from "next/server";
import { dbFail, fail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { indexPeople, storyBilling } from "@/lib/billing";
import { loadProgram } from "@/lib/data";
import { fmtPts, fmtUSD } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Product owner accepts a story. The database trigger re-checks the role and
// the "Ready for acceptance" state, and stamps the billing sprint.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole(["product_owner"]);
  if (viewer instanceof NextResponse) return viewer;
  const { id } = await params;
  const db = await createClient();

  const { data: updated, error } = await db
    .from("stories")
    .update({ status: "Accepted" })
    .eq("id", id)
    .eq("status", "Ready for acceptance")
    .select("id")
    .maybeSingle();
  if (error) return dbFail(error);
  if (!updated) return fail("Story is not ready for acceptance", 409);

  const { data, stories } = await loadProgram(db);
  const story = stories.find((s) => s.id === id)!;
  const b = storyBilling(
    story,
    data.assignments.filter((a) => a.story_id === id),
    indexPeople(data.people),
    data.ratePerPoint,
  );
  return NextResponse.json({
    message: `${story.key} accepted: +${fmtPts(b.billablePoints)} billable points (${fmtUSD(b.amount)})`,
    billablePoints: b.billablePoints,
    amount: b.amount,
  });
}
