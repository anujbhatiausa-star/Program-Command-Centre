// Program metrics derived from the raw tables. Pure; built on lib/billing.
import {
  groupAssignments,
  indexPeople,
  redactFinancials,
  round2,
  sprintBilling,
  sprintCost,
  sprintFinancials,
  storyBilling,
  type Assignment,
  type Person,
  type PersonCost,
  type Story,
} from "./billing";

export interface Sprint {
  id: string;
  number: number;
  name: string;
  status: "planned" | "active" | "closed";
  start_date: string;
  end_date: string;
}
export interface Invoice {
  id: string;
  number: string;
  sprint_id: string;
  status: "Draft" | "Sent" | "Paid";
  rate_per_point: number;
  billable_points: number;
  amount: number;
}
export interface StoryEvent {
  story_id: string;
  kind: "accepted" | "rejected";
}
export interface RaidItem {
  severity: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "Mitigating" | "Closed";
  type: string;
}

export interface ProgramData {
  ratePerPoint: number;
  sprints: Sprint[];
  stories: Story[];
  assignments: Assignment[];
  people: Person[];
  invoices: Invoice[];
  events: StoryEvent[];
  raid: RaidItem[];
}

/** PM-only inputs. Pass null for every other role: nothing financial is computed. */
export interface FinanceData {
  costs: PersonCost[];
  marginTargetPct: number;
}

export interface SprintRow {
  id: string;
  number: number;
  name: string;
  status: Sprint["status"];
  acceptedPoints: number;
  algoworksPoints: number;
  customerPoints: number;
  billablePoints: number;
  revenue: number;
  // Delivery by the sprint the work was done in (Accepted or Ready for acceptance)
  deliveredAlgoworks: number;
  deliveredCustomer: number;
  awaitingPoints: number;
  invoice: Pick<Invoice, "id" | "number" | "status" | "amount"> | null;
  // PM only
  cost?: number;
  margin?: number;
  marginPct?: number | null;
  breakEvenPoints?: number;
  costPerBillablePoint?: number | null;
  isLoss?: boolean;
}

export function sprintRows(data: ProgramData, finance: FinanceData | null): SprintRow[] {
  const byStory = groupAssignments(data.assignments);
  const peopleIdx = indexPeople(data.people);
  const delivery = new Map<string, { algoworks: number; customer: number; awaiting: number }>();
  for (const s of data.stories) {
    if (!s.sprint_id || (s.status !== "Accepted" && s.status !== "Ready for acceptance")) continue;
    const b = storyBilling(s, byStory.get(s.id) ?? [], peopleIdx, data.ratePerPoint);
    const d = delivery.get(s.sprint_id) ?? { algoworks: 0, customer: 0, awaiting: 0 };
    d.algoworks += b.algoworksPoints;
    d.customer += b.customerPoints;
    d.awaiting += b.awaitingPoints;
    delivery.set(s.sprint_id, d);
  }
  return data.sprints
    .filter((s) => s.status !== "planned")
    .sort((a, b) => a.number - b.number)
    .map((s) => {
      const b = sprintBilling(s.id, data.stories, data.assignments, data.people, data.ratePerPoint);
      const inv = data.invoices.find((i) => i.sprint_id === s.id);
      const row: SprintRow = {
        id: s.id,
        number: s.number,
        name: s.name,
        status: s.status,
        acceptedPoints: b.acceptedPoints,
        algoworksPoints: b.algoworksPoints,
        customerPoints: b.customerPoints,
        billablePoints: b.billablePoints,
        revenue: b.revenue,
        deliveredAlgoworks: round2(delivery.get(s.id)?.algoworks ?? 0),
        deliveredCustomer: round2(delivery.get(s.id)?.customer ?? 0),
        awaitingPoints: round2(delivery.get(s.id)?.awaiting ?? 0),
        invoice: inv ? { id: inv.id, number: inv.number, status: inv.status, amount: Number(inv.amount) } : null,
      };
      if (!finance) return row;
      const f = sprintFinancials(b.billablePoints, sprintCost(s.number, data.people, finance.costs), data.ratePerPoint);
      return {
        ...row,
        cost: f.cost,
        margin: f.margin,
        marginPct: f.marginPct,
        breakEvenPoints: f.breakEvenPoints,
        costPerBillablePoint: f.costPerBillablePoint,
        isLoss: f.isLoss,
      };
    });
}

export interface Overview {
  currentSprint: { id: string; name: string; end_date: string } | null;
  billableThisSprint: number;
  revenueThisSprint: number;
  deliveredAlgoworks: number;
  deliveredCustomer: number;
  revenueToDate: number;
  acceptanceRate: number | null;
  awaitingPoints: number;
  awaitingAmount: number;
  unpaidInvoices: number;
  cashAtRisk: number;
  openHighRisks: number;
  sprints: SprintRow[];
  // PM only
  marginToDate?: number;
  marginPct?: number | null;
  marginTargetPct?: number;
}

export function buildOverview(data: ProgramData, finance: FinanceData | null): Overview {
  const rows = sprintRows(data, finance);
  const current = data.sprints.find((s) => s.status === "active") ?? null;
  const currentRow = rows.find((r) => r.id === current?.id);
  const byStory = groupAssignments(data.assignments);
  const peopleIdx = indexPeople(data.people);

  let awaitingPoints = 0;
  for (const s of data.stories) {
    if (s.status !== "Ready for acceptance") continue;
    awaitingPoints += storyBilling(s, byStory.get(s.id) ?? [], peopleIdx, data.ratePerPoint).awaitingPoints;
  }
  awaitingPoints = round2(awaitingPoints);
  const awaitingAmount = round2(awaitingPoints * data.ratePerPoint);
  // Unpaid = issued but not yet paid. Drafts are not yet the customer's liability.
  const unpaidInvoices = round2(
    data.invoices.filter((i) => i.status === "Sent").reduce((s, i) => s + Number(i.amount), 0),
  );
  const decisions = data.events.length;
  const accepted = data.events.filter((e) => e.kind === "accepted").length;

  const overview: Overview = {
    currentSprint: current ? { id: current.id, name: current.name, end_date: current.end_date } : null,
    billableThisSprint: currentRow?.billablePoints ?? 0,
    revenueThisSprint: currentRow?.revenue ?? 0,
    deliveredAlgoworks: round2(rows.reduce((s, r) => s + r.algoworksPoints, 0)),
    deliveredCustomer: round2(rows.reduce((s, r) => s + r.customerPoints, 0)),
    revenueToDate: round2(rows.reduce((s, r) => s + r.revenue, 0)),
    acceptanceRate: decisions ? round2((accepted / decisions) * 100) : null,
    awaitingPoints,
    awaitingAmount,
    unpaidInvoices,
    cashAtRisk: round2(awaitingAmount + unpaidInvoices),
    openHighRisks: data.raid.filter(
      (r) => r.type === "Risk" && r.status !== "Closed" && (r.severity === "High" || r.severity === "Critical"),
    ).length,
    sprints: rows,
  };
  if (!finance) return redactFinancials(overview);

  // Margin to date uses closed sprints only: the active sprint carries full cost
  // but only part of its revenue until acceptance finishes.
  const closed = rows.filter((r) => r.status === "closed");
  const closedRevenue = closed.reduce((s, r) => s + r.revenue, 0);
  const margin = round2(closedRevenue - closed.reduce((s, r) => s + (r.cost ?? 0), 0));
  return {
    ...overview,
    marginToDate: margin,
    marginPct: closedRevenue > 0 ? round2((margin / closedRevenue) * 100) : null,
    marginTargetPct: finance.marginTargetPct,
  };
}
