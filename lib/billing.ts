// Billing rules for the program. Pure functions only: no I/O, no Supabase.
//
// 1. A story has points and assignments (person + share %); shares total 100.
// 2. Each person belongs to "algoworks" or "customer".
// 3. Algoworks billable points = points x (Algoworks share / 100).
// 4. Only Accepted stories bill. Ready-for-acceptance points are "awaiting".
// 5. Accepted stories bill in the sprint they were accepted in.
// 6. Revenue = billable points x rate. Cost = Algoworks people only.
// 8. Break-even billable points = sprint cost / rate.

export type Org = "algoworks" | "customer";
export type StoryStatus = "Backlog" | "In progress" | "Ready for acceptance" | "Accepted";

export interface Person {
  id: string;
  name: string;
  org: Org;
  allocation_pct: number;
  start_sprint: number;
}

export interface Assignment {
  story_id: string;
  person_id: string;
  share_pct: number;
}

export interface Story {
  id: string;
  key: string;
  title: string;
  points: number;
  status: StoryStatus;
  sprint_id: string | null;
  accepted_sprint_id: string | null;
}

export interface PersonCost {
  person_id: string;
  cost_per_sprint: number;
}

/** Points and money are rounded to 2 decimals so split shares stay exact enough to invoice. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function validateShares(assignments: Assignment[]): { ok: boolean; total: number } {
  const total = round2(assignments.reduce((s, a) => s + a.share_pct, 0));
  const ok = assignments.length > 0 && total === 100 && assignments.every((a) => a.share_pct > 0);
  return { ok, total };
}

export function indexPeople(people: Person[]): Map<string, Person> {
  return new Map(people.map((p) => [p.id, p]));
}

export function groupAssignments(assignments: Assignment[]): Map<string, Assignment[]> {
  const byStory = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const list = byStory.get(a.story_id) ?? [];
    list.push(a);
    byStory.set(a.story_id, list);
  }
  return byStory;
}

/** Percentage of a story held by Algoworks people (0-100). */
export function algoworksPct(storyAssignments: Assignment[], people: Map<string, Person>): number {
  const { ok, total } = validateShares(storyAssignments);
  if (!ok) throw new Error(`Assignment shares must total 100 (got ${total})`);
  return round2(
    storyAssignments
      .filter((a) => people.get(a.person_id)?.org === "algoworks")
      .reduce((s, a) => s + a.share_pct, 0),
  );
}

export interface StoryBilling {
  storyId: string;
  points: number;
  algoworksPct: number;
  algoworksPoints: number; // delivered capacity by Algoworks (billable once accepted)
  customerPoints: number; // delivered capacity by the customer team (never billed)
  billablePoints: number; // > 0 only when Accepted
  awaitingPoints: number; // Algoworks points ready for acceptance, not yet earned
  amount: number; // billablePoints x rate
  awaitingAmount: number;
}

export function storyBilling(
  story: Story,
  storyAssignments: Assignment[],
  people: Map<string, Person>,
  ratePerPoint: number,
): StoryBilling {
  const pct = algoworksPct(storyAssignments, people);
  const algoworksPoints = round2((story.points * pct) / 100);
  const customerPoints = round2(story.points - algoworksPoints);
  const billablePoints = story.status === "Accepted" ? algoworksPoints : 0;
  const awaitingPoints = story.status === "Ready for acceptance" ? algoworksPoints : 0;
  return {
    storyId: story.id,
    points: story.points,
    algoworksPct: pct,
    algoworksPoints,
    customerPoints,
    billablePoints,
    awaitingPoints,
    amount: round2(billablePoints * ratePerPoint),
    awaitingAmount: round2(awaitingPoints * ratePerPoint),
  };
}

export interface InvoiceLine {
  story_id: string;
  story_key: string;
  story_title: string;
  points: number;
  algoworks_pct: number;
  billable_points: number;
  amount: number;
}

export interface SprintBilling {
  sprintId: string;
  acceptedPoints: number; // all accepted points (both organisations)
  algoworksPoints: number;
  customerPoints: number;
  billablePoints: number; // = algoworksPoints of accepted stories
  revenue: number;
  lines: InvoiceLine[];
}

/** Billing for one sprint: stories whose acceptance happened in that sprint (rule 5). */
export function sprintBilling(
  sprintId: string,
  stories: Story[],
  assignments: Assignment[],
  people: Person[],
  ratePerPoint: number,
): SprintBilling {
  const byStory = groupAssignments(assignments);
  const peopleIdx = indexPeople(people);
  const lines: InvoiceLine[] = [];
  let acceptedPoints = 0;
  let customerPoints = 0;
  for (const s of stories) {
    if (s.status !== "Accepted" || s.accepted_sprint_id !== sprintId) continue;
    const b = storyBilling(s, byStory.get(s.id) ?? [], peopleIdx, ratePerPoint);
    acceptedPoints += s.points;
    customerPoints += b.customerPoints;
    lines.push({
      story_id: s.id,
      story_key: s.key,
      story_title: s.title,
      points: s.points,
      algoworks_pct: b.algoworksPct,
      billable_points: b.billablePoints,
      amount: b.amount,
    });
  }
  lines.sort((a, b) => a.story_key.localeCompare(b.story_key));
  const billablePoints = round2(lines.reduce((s, l) => s + l.billable_points, 0));
  return {
    sprintId,
    acceptedPoints,
    algoworksPoints: billablePoints,
    customerPoints: round2(customerPoints),
    billablePoints,
    revenue: round2(lines.reduce((s, l) => s + l.amount, 0)),
    lines,
  };
}

/** Cost of Algoworks people on the sprint: cost per sprint x allocation (rule 6). */
export function sprintCost(sprintNumber: number, people: Person[], costs: PersonCost[]): number {
  const costIdx = new Map(costs.map((c) => [c.person_id, c.cost_per_sprint]));
  return round2(
    people
      .filter((p) => p.org === "algoworks" && p.start_sprint <= sprintNumber)
      .reduce((s, p) => s + (costIdx.get(p.id) ?? 0) * (p.allocation_pct / 100), 0),
  );
}

export interface SprintFinancials {
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null; // null when there is no revenue
  costPerBillablePoint: number | null;
  breakEvenPoints: number;
  isLoss: boolean;
}

export function sprintFinancials(
  billablePoints: number,
  cost: number,
  ratePerPoint: number,
): SprintFinancials {
  const revenue = round2(billablePoints * ratePerPoint);
  const margin = round2(revenue - cost);
  return {
    revenue,
    cost,
    margin,
    marginPct: revenue > 0 ? round2((margin / revenue) * 100) : null,
    costPerBillablePoint: billablePoints > 0 ? round2(cost / billablePoints) : null,
    breakEvenPoints: breakEvenPoints(cost, ratePerPoint),
    isLoss: margin < 0,
  };
}

export function breakEvenPoints(cost: number, ratePerPoint: number): number {
  if (ratePerPoint <= 0) throw new Error("Rate per point must be positive");
  return round2(cost / ratePerPoint);
}

// Acceptance workflow (rule 4). The database trigger enforces the same rules;
// this mirror keeps the behaviour testable and is used by the route handlers.
export type AcceptanceAction =
  | { kind: "accept"; sprintId: string }
  | { kind: "reject"; reason: string };

export function applyAcceptance(story: Story, action: AcceptanceAction): Story {
  if (story.status !== "Ready for acceptance") {
    throw new Error(`Only stories ready for acceptance can be accepted or rejected (was ${story.status})`);
  }
  if (action.kind === "accept") {
    return { ...story, status: "Accepted", accepted_sprint_id: action.sprintId };
  }
  if (action.reason.trim().length < 5) throw new Error("A rejection needs a reason");
  return { ...story, status: "In progress", accepted_sprint_id: null };
}

// Fields that must never reach a customer user (rule 7 and the security bar).
export const FINANCIAL_KEYS = [
  "cost",
  "margin",
  "marginPct",
  "marginTargetPct",
  "costPerBillablePoint",
  "breakEvenPoints",
  "cost_per_sprint",
  "isLoss",
] as const;

/** Deep copy with every cost/margin field removed. Used for every non-PM payload. */
export function redactFinancials<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactFinancials) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if ((FINANCIAL_KEYS as readonly string[]).includes(k)) continue;
      out[k] = redactFinancials(v);
    }
    return out as T;
  }
  return value;
}
