import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { BillingRules } from "@/components/BillingRules";
import { Badge, Card, PageHeader, PmOnly, Td, Th } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { loadFinance, loadProgram } from "@/lib/data";
import { fmtPct, fmtPts, fmtUSD } from "@/lib/format";
import { sprintRows } from "@/lib/metrics";
import { createClient } from "@/lib/supabase/server";

export default async function BillingPage() {
  const viewer = await requirePage("/billing");
  const db = await createClient();
  const [{ config, data }, finance] = await Promise.all([loadProgram(db), loadFinance(db, viewer)]);
  const rows = sprintRows(data, finance).reverse();
  const isPm = viewer.role === "pm";
  const totalInvoiced = data.invoices.filter((i) => i.status !== "Draft").reduce((s, i) => s + i.amount, 0);
  const paid = data.invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + i.amount, 0);

  return (
    <>
      <PageHeader
        title="Billing statement"
        subtitle={`${config.customer_name} · ${fmtUSD(config.rate_per_point)} per accepted Algoworks point · ${fmtUSD(totalInvoiced)} invoiced (sent or paid), ${fmtUSD(paid)} paid`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Sprint by sprint" info="Accepted points are all points accepted in the sprint; billable points are the Algoworks share of them." className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <Th>Sprint</Th>
                  <Th className="text-right">Accepted pts</Th>
                  <Th className="text-right">Billable pts</Th>
                  <Th className="text-right">Rate</Th>
                  <Th className="text-right">Amount</Th>
                  {isPm && <Th className="text-right">Margin</Th>}
                  <Th>Invoice</Th>
                  {isPm && <Th>Actions</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className={r.status === "active" ? "bg-accent-soft/60" : ""}>
                    <Td className="whitespace-nowrap">{r.name}</Td>
                    <Td className="text-right tabular-nums">{fmtPts(r.acceptedPoints)}</Td>
                    <Td className="text-right font-medium tabular-nums">{fmtPts(r.billablePoints)}</Td>
                    <Td className="text-right tabular-nums">{fmtUSD(config.rate_per_point)}</Td>
                    <Td className="text-right tabular-nums">{fmtUSD(r.revenue)}</Td>
                    {isPm && (
                      <Td className={`text-right tabular-nums ${r.isLoss ? "text-red-700" : ""}`}>{fmtPct(r.marginPct)}</Td>
                    )}
                    <Td>
                      {r.invoice ? (
                        <Link href={`/billing/${r.invoice.id}`} className="inline-flex items-center gap-2 whitespace-nowrap text-accent underline-offset-2 hover:underline">
                          {r.invoice.number} <Badge>{r.invoice.status}</Badge>
                        </Link>
                      ) : r.status === "active" ? (
                        <span className="text-xs text-slate-600">In progress: invoiced at sprint close</span>
                      ) : (
                        <span className="text-xs text-slate-600">Not yet issued</span>
                      )}
                    </Td>
                    {isPm && (
                      <Td className="whitespace-nowrap">
                        {r.status === "active" && (
                          <ActionButton
                            url={`/api/sprints/${r.id}/close`}
                            label={`Close ${r.name}`}
                            className="btn-primary"
                            confirm={`Close ${r.name}? A draft invoice is created for ${fmtPts(r.billablePoints)} billable points. Unaccepted stories move to the next sprint.`}
                          />
                        )}
                        {r.invoice?.status === "Draft" && (
                          <ActionButton url={`/api/invoices/${r.invoice.id}/status`} body={{ status: "Sent" }} label="Mark sent" />
                        )}
                        {r.invoice?.status === "Sent" && (
                          <ActionButton url={`/api/invoices/${r.invoice.id}/status`} body={{ status: "Paid" }} label="Mark paid" />
                        )}
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isPm && (
            <p className="mt-3 text-xs text-slate-600">
              Margin column <PmOnly /> Customers see only sent and paid invoices, never cost or margin.
            </p>
          )}
        </Card>
        <BillingRules rate={config.rate_per_point} windowDays={config.acceptance_window_days} />
      </div>
    </>
  );
}
