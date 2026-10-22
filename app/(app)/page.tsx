import { MarginChart, StackedPointsChart } from "@/components/Charts";
import { COLORS } from "@/lib/colors";
import { Card, PageHeader, PmOnly, SplitBar, Td, Th, Tile } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { loadFinance, loadProgram } from "@/lib/data";
import { fmtDate, fmtPct, fmtPts, fmtUSD } from "@/lib/format";
import { buildOverview } from "@/lib/metrics";
import { createClient } from "@/lib/supabase/server";

export default async function OverviewPage() {
  const viewer = await requirePage("/");
  const db = await createClient();
  const [{ config, data }, finance] = await Promise.all([loadProgram(db), loadFinance(db, viewer)]);
  const o = buildOverview(data, finance);
  const isPm = viewer.role === "pm";
  const delivered = o.deliveredAlgoworks + o.deliveredCustomer;
  const closed = o.sprints.filter((s) => s.status === "closed");
  const label = (n: number) => `S${n}`;

  const velocity = o.sprints.map((s) => ({
    sprint: label(s.number),
    algoworks: s.deliveredAlgoworks,
    customer: s.deliveredCustomer,
    ...(isPm && s.breakEvenPoints !== undefined ? { breakEven: s.breakEvenPoints } : {}),
  }));
  const billable = o.sprints.map((s) => ({
    sprint: label(s.number),
    billable: s.billablePoints,
    customer: s.customerPoints,
    awaiting: s.awaitingPoints,
  }));

  return (
    <>
      <PageHeader
        title="Program overview"
        subtitle={
          <>
            {config.program_name} · {o.currentSprint ? `${o.currentSprint.name} ends ${fmtDate(o.currentSprint.end_date)}` : "No active sprint"} · Rate{" "}
            {fmtUSD(config.rate_per_point)} per accepted point
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Billable points this sprint"
          value={fmtPts(o.billableThisSprint)}
          sub={`${fmtUSD(o.revenueThisSprint)} so far in ${o.currentSprint?.name ?? "the current sprint"}`}
          info="Algoworks share of story points accepted by the customer during the current sprint. Only accepted points bill, and only the Algoworks share."
        />
        <Tile
          label="Delivered points to date"
          value={fmtPts(delivered)}
          info="All accepted story points, split by who delivered them (by assignment share). Customer-delivered points are tracked as capacity but never billed."
        >
          <div className="mt-2">
            <SplitBar algoworksPct={delivered ? (o.deliveredAlgoworks / delivered) * 100 : 0} showLabel={false} />
            <div className="mt-1 flex justify-between text-[11px] text-slate-600">
              <span>Algoworks {fmtPts(o.deliveredAlgoworks)}</span>
              <span>Customer {fmtPts(o.deliveredCustomer)}</span>
            </div>
          </div>
        </Tile>
        <Tile
          label="Revenue to date"
          value={fmtUSD(o.revenueToDate)}
          sub={`${fmtPts(o.deliveredAlgoworks)} billable points × ${fmtUSD(config.rate_per_point)}`}
          info="Billable (accepted, Algoworks-share) points multiplied by the contract rate per point, across all sprints including the current one."
        />
        {isPm ? (
          <Tile
            label="Margin vs target"
            value={fmtPct(o.marginPct)}
            tone={o.marginPct == null ? "default" : o.marginPct >= (o.marginTargetPct ?? 0) ? "good" : o.marginPct >= 0 ? "warn" : "bad"}
            sub={
              <span className="flex flex-wrap items-center gap-1">
                Target {fmtPct(o.marginTargetPct)} · {fmtUSD(o.marginToDate ?? 0)} on closed sprints <PmOnly />
              </span>
            }
            info="(Revenue − Algoworks cost) ÷ revenue over closed sprints. Cost = each Algoworks person's cost per sprint × allocation. Customer people carry no cost. Visible to the Algoworks PM only."
          />
        ) : (
          <Tile
            label="Awaiting acceptance"
            value={fmtPts(o.awaitingPoints)}
            sub={`${fmtUSD(o.awaitingAmount)} billable once accepted`}
            info="Algoworks share of stories that are delivered and ready for acceptance. They earn nothing until the product owner accepts them."
          />
        )}
        <Tile
          label="Acceptance rate"
          value={fmtPct(o.acceptanceRate)}
          sub="of acceptance decisions were accepts"
          info="Accept decisions ÷ all accept-or-reject decisions by the product owner. A rejected story goes back to In progress and counts as one rejection."
        />
        <Tile
          label="Cash at risk"
          value={fmtUSD(o.cashAtRisk)}
          tone={o.cashAtRisk > 0 ? "warn" : "default"}
          sub={`${fmtUSD(o.awaitingAmount)} awaiting acceptance + ${fmtUSD(o.unpaidInvoices)} sent, unpaid`}
          info="Value Algoworks has delivered but not yet been paid for: the Algoworks share of stories awaiting acceptance at the contract rate, plus invoices sent but not yet paid."
        />
        <Tile
          label="Open high risks"
          value={o.openHighRisks}
          tone={o.openHighRisks > 0 ? "bad" : "good"}
          sub="High or Critical risks not closed"
          info="RAID items of type Risk with severity High or Critical whose status is Open or Mitigating."
        />
        {isPm && (
          <Tile
            label="Awaiting acceptance"
            value={fmtPts(o.awaitingPoints)}
            sub={`${fmtUSD(o.awaitingAmount)} billable once accepted`}
            info="Algoworks share of stories that are delivered and ready for acceptance. They earn nothing until the product owner accepts them."
          />
        )}
      </div>

      <div className={`mt-4 grid gap-4 ${isPm ? "lg:grid-cols-2" : ""}`}>
        {isPm && (
          <Card
            title="Velocity by organisation"
            info="Story points delivered (accepted or ready for acceptance) in each sprint, split by assignment share. The dashed line is break-even: sprint cost ÷ rate per point, in billable points."
            actions={<PmOnly />}
          >
            <StackedPointsChart
              data={velocity}
              series={[
                { key: "algoworks", name: "Algoworks", color: COLORS.algoworks },
                { key: "customer", name: "Customer", color: COLORS.customer },
              ]}
              reference={{ key: "breakEven", name: "Break-even (billable points)" }}
            />
          </Card>
        )}
        {isPm && finance && (
          <Card
            title="Margin trend"
            info="Margin % per sprint: (revenue − Algoworks cost) ÷ revenue, with the target as a dashed line. The current sprint is excluded until it closes."
            actions={<PmOnly />}
          >
            <MarginChart
              data={closed.map((s) => ({ sprint: label(s.number), marginPct: s.marginPct ?? null }))}
              target={finance.marginTargetPct}
            />
          </Card>
        )}
        <Card
          title="Billable vs non-billable points"
          info="Per sprint: billable = Algoworks share of stories accepted in that sprint; customer share = accepted points delivered by customer people (never billed); awaiting = Algoworks share delivered but not yet accepted."
          className={isPm ? "lg:col-span-2" : ""}
        >
          <StackedPointsChart
            data={billable}
            series={[
              { key: "billable", name: "Billable (Algoworks, accepted)", color: COLORS.algoworks },
              { key: "awaiting", name: "Awaiting acceptance", color: COLORS.awaiting },
              { key: "customer", name: "Customer share (not billed)", color: COLORS.customer },
            ]}
          />
        </Card>
      </div>

      <Card title="Sprint summary" info="The numbers behind the charts." className="mt-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr>
                <Th>Sprint</Th>
                <Th className="text-right">Accepted pts</Th>
                <Th className="text-right">Billable pts</Th>
                <Th className="text-right">Customer pts</Th>
                <Th className="text-right">Revenue</Th>
                {isPm && (
                  <>
                    <Th className="text-right">Cost</Th>
                    <Th className="text-right">Margin</Th>
                    <Th className="text-right">Cost / billable pt</Th>
                    <Th className="text-right">Break-even pts</Th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {o.sprints.map((s) => (
                <tr key={s.id} className={s.status === "active" ? "bg-accent-soft/60" : ""}>
                  <Td>
                    {s.name}
                    {s.status === "active" && <span className="ml-2 text-xs text-accent">current</span>}
                  </Td>
                  <Td className="text-right tabular-nums">{fmtPts(s.acceptedPoints)}</Td>
                  <Td className="text-right tabular-nums font-medium">{fmtPts(s.billablePoints)}</Td>
                  <Td className="text-right tabular-nums">{fmtPts(s.customerPoints)}</Td>
                  <Td className="text-right tabular-nums">{fmtUSD(s.revenue)}</Td>
                  {isPm && (
                    <>
                      <Td className="text-right tabular-nums">{fmtUSD(s.cost ?? 0)}</Td>
                      <Td className={`text-right tabular-nums ${s.isLoss ? "font-medium text-red-700" : ""}`}>
                        {fmtUSD(s.margin ?? 0)} <span className="text-xs text-slate-500">({fmtPct(s.marginPct)})</span>
                      </Td>
                      <Td className="text-right tabular-nums">{s.costPerBillablePoint == null ? "–" : fmtUSD(s.costPerBillablePoint)}</Td>
                      <Td className="text-right tabular-nums">{fmtPts(s.breakEvenPoints ?? 0)}</Td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
