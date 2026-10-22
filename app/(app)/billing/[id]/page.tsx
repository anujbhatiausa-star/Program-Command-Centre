import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, PageHeader, Td, Th } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { fmtDate, fmtPct, fmtPts, fmtUSD } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

interface Line {
  id: string;
  story_key: string;
  story_title: string;
  points: number;
  algoworks_pct: number;
  billable_points: number;
  amount: number;
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePage("/billing");
  const { id } = await params;
  const db = await createClient();
  // RLS hides drafts from customer users, so a draft id simply returns nothing for them.
  const { data: inv } = await db
    .from("invoices")
    .select("id, number, status, rate_per_point, billable_points, amount, created_at, sent_at, paid_at, sprints(name, start_date, end_date)")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();
  const { data: lines } = await db.from("invoice_lines").select("*").eq("invoice_id", id).order("story_key");
  const sprint = inv.sprints as unknown as { name: string; start_date: string; end_date: string };
  const rows = (lines ?? []) as Line[];
  const totalPoints = rows.reduce((s, l) => s + Number(l.points), 0);

  return (
    <>
      <PageHeader
        title={`Invoice ${inv.number}`}
        subtitle={
          <>
            <Link href="/billing" className="text-accent hover:underline">
              Billing
            </Link>{" "}
            · {sprint.name} ({fmtDate(sprint.start_date)} – {fmtDate(sprint.end_date)})
          </>
        }
        actions={
          viewer.role === "pm" && inv.status !== "Paid" ? (
            <ActionButton
              url={`/api/invoices/${inv.id}/status`}
              body={{ status: inv.status === "Draft" ? "Sent" : "Paid" }}
              label={inv.status === "Draft" ? "Mark sent" : "Mark paid"}
              className="btn-primary"
            />
          ) : undefined
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Status", <Badge key="s">{inv.status}</Badge>],
          ["Billable points", fmtPts(Number(inv.billable_points))],
          ["Rate per point", fmtUSD(Number(inv.rate_per_point))],
          ["Amount due", <span key="a" className="font-semibold">{fmtUSD(Number(inv.amount))}</span>],
          ["Issued / paid", `${fmtDate(inv.sent_at)} / ${fmtDate(inv.paid_at)}`],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">{k}</div>
            <div className="mt-1 text-sm text-slate-900">{v}</div>
          </div>
        ))}
      </div>
      <Card title="Per-story split" info="Each accepted story in the sprint, the Algoworks share of its points, and the amount billed. Customer-delivered shares are listed but bill nothing.">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr>
                <Th>Story</Th>
                <Th className="text-right">Points</Th>
                <Th className="text-right">Algoworks %</Th>
                <Th className="text-right">Billable pts</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <span className="font-mono text-xs text-slate-500">{l.story_key}</span> {l.story_title}
                  </Td>
                  <Td className="text-right tabular-nums">{fmtPts(Number(l.points))}</Td>
                  <Td className="text-right tabular-nums">{fmtPct(Number(l.algoworks_pct))}</Td>
                  <Td className="text-right tabular-nums">{fmtPts(Number(l.billable_points))}</Td>
                  <Td className="text-right tabular-nums">{fmtUSD(Number(l.amount))}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 font-semibold">
              <tr>
                <Td>Total</Td>
                <Td className="text-right tabular-nums">{fmtPts(totalPoints)}</Td>
                <Td />
                <Td className="text-right tabular-nums">{fmtPts(Number(inv.billable_points))}</Td>
                <Td className="text-right tabular-nums">{fmtUSD(Number(inv.amount))}</Td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}
