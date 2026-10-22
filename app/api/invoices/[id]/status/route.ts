import { NextResponse } from "next/server";
import { dbFail, fail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// PM moves an invoice Draft -> Sent -> Paid (the database rejects any other move).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole(["pm"]);
  if (viewer instanceof NextResponse) return viewer;
  const { id } = await params;
  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (status !== "Sent" && status !== "Paid") return fail("Status must be Sent or Paid");

  const db = await createClient();
  const { data, error } = await db.from("invoices").update({ status }).eq("id", id).select("number").maybeSingle();
  if (error) return dbFail(error);
  if (!data) return fail("Invoice not found", 404);
  return NextResponse.json({ message: `${data.number} marked ${status}` });
}
