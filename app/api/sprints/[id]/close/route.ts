import { NextResponse } from "next/server";
import { dbFail, fail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { sprintBilling } from "@/lib/billing";
import { loadProgram } from "@/lib/data";
import { fmtPts, fmtUSD } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// PM closes the active sprint: draft invoice for its accepted Algoworks points,
// unfinished stories carry over, and the next sprint becomes active.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole(["pm"]);
  if (viewer instanceof NextResponse) return viewer;
  const { id } = await params;
  const db = await createClient();
  const { data } = await loadProgram(db);

  const sprint = data.sprints.find((s) => s.id === id);
  if (!sprint) return fail("Sprint not found", 404);
  if (sprint.status !== "active") return fail(`${sprint.name} is not the active sprint`, 409);

  const b = sprintBilling(id, data.stories, data.assignments, data.people, data.ratePerPoint);
  const { data: invoice, error: invErr } = await db
    .from("invoices")
    .insert({
      number: `INV-S${String(sprint.number).padStart(2, "0")}`,
      sprint_id: id,
      status: "Draft",
      rate_per_point: data.ratePerPoint,
      billable_points: b.billablePoints,
      amount: b.revenue,
    })
    .select("id")
    .single();
  if (invErr) return dbFail(invErr);
  if (b.lines.length) {
    const { error } = await db.from("invoice_lines").insert(b.lines.map((l) => ({ ...l, invoice_id: invoice.id })));
    if (error) return dbFail(error);
  }

  // Find or create the next sprint, then hand over.
  let next = data.sprints.find((s) => s.number === sprint.number + 1);
  if (!next) {
    const start = new Date(new Date(sprint.end_date).getTime() + 3 * 86400000);
    const end = new Date(start.getTime() + 11 * 86400000);
    const { data: created, error } = await db
      .from("sprints")
      .insert({
        number: sprint.number + 1,
        name: `Sprint ${sprint.number + 1}`,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        status: "planned",
      })
      .select("*")
      .single();
    if (error) return dbFail(error);
    next = created;
  }
  const carry = await db.from("stories").update({ sprint_id: next!.id }).eq("sprint_id", id).neq("status", "Accepted");
  if (carry.error) return dbFail(carry.error);
  const closed = await db.from("sprints").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
  if (closed.error) return dbFail(closed.error);
  const opened = await db.from("sprints").update({ status: "active" }).eq("id", next!.id);
  if (opened.error) return dbFail(opened.error);

  return NextResponse.json({
    message: `${sprint.name} closed. Draft invoice for ${fmtPts(b.billablePoints)} billable points (${fmtUSD(b.revenue)}). ${next!.name} is now active.`,
  });
}
