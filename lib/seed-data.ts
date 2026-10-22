// Sample data for the demo. Pure: builds every row from a reference date so the
// current sprint always contains "today". Invoices are computed with lib/billing.
import {
  round2,
  sprintBilling,
  type Assignment,
  type InvoiceLine,
  type Person,
  type Story,
  type StoryStatus,
} from "./billing";

/** Stable UUIDs so the seed is idempotent and profiles keep pointing at the same people. */
const uid = (kind: number, n: number) =>
  `0000000${kind}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const RATE_PER_POINT = 900;
export const ACCEPTANCE_WINDOW_DAYS = 5;
export const MARGIN_TARGET_PCT = 25;
const SPRINT_DAYS = 14;
const CURRENT_SPRINT = 8;

type PersonSeed = {
  key: string;
  name: string;
  org: "algoworks" | "customer";
  role_title: string;
  location: string;
  region: "Onshore" | "Offshore";
  allocation_pct?: number;
  start_sprint?: number;
  email?: string;
  cost?: number; // Algoworks only, per sprint at 100% allocation (PM-only table)
};

const PEOPLE: PersonSeed[] = [
  { key: "dbrooks", name: "Daniel Brooks", org: "algoworks", role_title: "Delivery Lead (Program Manager)", location: "Dallas, US", region: "Onshore", allocation_pct: 40, cost: 12000, email: "pm@algoworks.demo" },
  { key: "mortiz", name: "Megan Ortiz", org: "algoworks", role_title: "Business Analyst", location: "Charlotte, US", region: "Onshore", allocation_pct: 50, cost: 8000, email: "ba@algoworks.demo" },
  { key: "amehta", name: "Arjun Mehta", org: "algoworks", role_title: "Salesforce Developer", location: "Noida, India (US hours)", region: "Offshore", cost: 2400 },
  { key: "skulkarni", name: "Sneha Kulkarni", org: "algoworks", role_title: "Salesforce Developer", location: "Pune, India (US hours)", region: "Offshore", cost: 2300 },
  { key: "kiyer", name: "Kavya Iyer", org: "algoworks", role_title: "Salesforce Admin / Configurator", location: "Bengaluru, India (US hours)", region: "Offshore", cost: 2000 },
  { key: "rverma", name: "Rahul Verma", org: "algoworks", role_title: "Integration Developer", location: "Noida, India (US hours)", region: "Offshore", start_sprint: 2, cost: 2500 },
  { key: "adas", name: "Ananya Das", org: "algoworks", role_title: "Data Migration Specialist", location: "Pune, India (US hours)", region: "Offshore", start_sprint: 2, cost: 2200 },
  { key: "vsingh", name: "Vikram Singh", org: "algoworks", role_title: "QA Engineer", location: "Noida, India (US hours)", region: "Offshore", start_sprint: 3, cost: 1800 },
  { key: "lchen", name: "Laura Chen", org: "customer", role_title: "Product Owner", location: "New York, US", region: "Onshore", email: "po@customer.demo" },
  { key: "spatel", name: "Sarah Patel", org: "customer", role_title: "Executive Sponsor", location: "New York, US", region: "Onshore", allocation_pct: 20, email: "sponsor@customer.demo" },
  { key: "jwalker", name: "James Walker", org: "customer", role_title: "Salesforce Developer", location: "Charlotte, US", region: "Onshore" },
  { key: "ogrant", name: "Olivia Grant", org: "customer", role_title: "QA Analyst", location: "Charlotte, US", region: "Onshore" },
  { key: "bfoster", name: "Ben Foster", org: "customer", role_title: "Middleware Engineer", location: "New York, US", region: "Onshore" },
];

export const DEMO_USERS = [
  { email: "pm@algoworks.demo", role: "pm", org: "algoworks", person: "dbrooks" },
  { email: "ba@algoworks.demo", role: "ba", org: "algoworks", person: "mortiz" },
  { email: "sponsor@customer.demo", role: "sponsor", org: "customer", person: "spatel" },
  { email: "po@customer.demo", role: "product_owner", org: "customer", person: "lchen" },
] as const;

export const personId = (key: string) => uid(1, PEOPLE.findIndex((p) => p.key === key) + 1);

const EPICS = [
  ["EP-1", "Case management", "Service Cloud"],
  ["EP-2", "Omni-channel routing, entitlements and SLAs", "Service Cloud"],
  ["EP-3", "Customer portal", "Experience Cloud"],
  ["EP-4", "Household and financial accounts", "Financial Services Cloud"],
  ["EP-5", "Unified customer profile", "Data Cloud"],
  ["EP-6", "Core banking integration", "Integration"],
  ["EP-7", "Legacy data migration", "Data migration"],
  ["EP-8", "Security and compliance", "Security"],
  ["EP-9", "Delivery pipeline", "DevOps"],
  ["EP-10", "Lead-to-opportunity and forecasting", "Sales Cloud"],
] as const;

type StorySeed = {
  key: string;
  title: string;
  epic: string;
  type: "Configuration" | "Flow" | "Apex" | "LWC" | "Integration" | "Migration" | "Testing";
  points: number;
  sprint: number | null; // sprint the work is planned in
  status: StoryStatus;
  accepted?: number; // sprint it was accepted in (defaults to its own sprint)
  readyDaysAgo?: number; // for stories awaiting acceptance
  rejected?: { sprint: number; reason: string }; // an earlier rejection
  split: [string, number][];
};

const STORIES: StorySeed[] = [
  // Sprint 1: handover from the previous vendor
  { key: "SF-101", title: "Git repository and branching strategy for org metadata", epic: "EP-9", type: "Configuration", points: 5, sprint: 1, status: "Accepted", split: [["amehta", 100]] },
  { key: "SF-102", title: "Review org-wide defaults and sharing model", epic: "EP-8", type: "Configuration", points: 5, sprint: 1, status: "Accepted", split: [["kiyer", 50], ["jwalker", 50]] },
  { key: "SF-103", title: "Case record types and page layouts for retail banking", epic: "EP-1", type: "Configuration", points: 3, sprint: 1, status: "Accepted", split: [["jwalker", 100]] },
  // Sprint 2
  { key: "SF-104", title: "CI/CD pipeline with validation deploys to QA/SIT", epic: "EP-9", type: "Configuration", points: 8, sprint: 2, status: "Accepted", split: [["amehta", 60], ["kiyer", 40]] },
  { key: "SF-105", title: "Case auto-assignment and escalation flow", epic: "EP-1", type: "Flow", points: 8, sprint: 2, status: "Accepted", split: [["skulkarni", 70], ["jwalker", 30]] },
  { key: "SF-106", title: "Mock load 1: accounts and contacts from legacy CRM", epic: "EP-7", type: "Migration", points: 13, sprint: 2, status: "Accepted", split: [["adas", 70], ["bfoster", 30]] },
  { key: "SF-107", title: "Core banking middleware connectivity (auth, endpoints)", epic: "EP-6", type: "Integration", points: 5, sprint: 2, status: "Accepted", split: [["rverma", 50], ["bfoster", 50]] },
  // Sprint 3
  { key: "SF-108", title: "Omni-channel routing for case queues", epic: "EP-2", type: "Configuration", points: 8, sprint: 3, status: "Accepted", split: [["kiyer", 100]] },
  { key: "SF-109", title: "Entitlements and SLA milestones for premium clients", epic: "EP-2", type: "Flow", points: 13, sprint: 3, status: "Accepted", split: [["skulkarni", 50], ["vsingh", 20], ["ogrant", 30]] },
  { key: "SF-110", title: "Household model and relationship groups", epic: "EP-4", type: "Configuration", points: 8, sprint: 3, status: "Accepted", split: [["kiyer", 70], ["jwalker", 30]] },
  { key: "SF-111", title: "Permission set groups for service agents", epic: "EP-8", type: "Configuration", points: 8, sprint: 3, status: "Accepted", split: [["kiyer", 100]] },
  { key: "SF-112", title: "Regression suite for inherited defects", epic: "EP-1", type: "Testing", points: 5, sprint: 3, status: "Accepted", split: [["ogrant", 100]] },
  // Sprint 4
  { key: "SF-113", title: "Account balance callout to core banking via middleware", epic: "EP-6", type: "Integration", points: 13, sprint: 4, status: "Accepted", rejected: { sprint: 4, reason: "Balance shown without currency; needs multi-currency format" }, split: [["rverma", 70], ["bfoster", 30]] },
  { key: "SF-114", title: "Financial accounts and holdings related lists", epic: "EP-4", type: "Configuration", points: 8, sprint: 4, status: "Accepted", split: [["amehta", 50], ["kiyer", 50]] },
  { key: "SF-115", title: "Portal login and self-registration", epic: "EP-3", type: "LWC", points: 13, sprint: 4, status: "Accepted", split: [["skulkarni", 60], ["amehta", 40]] },
  { key: "SF-116", title: "Mock load 2: financial accounts with reconciliation", epic: "EP-7", type: "Migration", points: 8, sprint: 4, status: "Accepted", split: [["adas", 70], ["bfoster", 30]] },
  // Sprint 5
  { key: "SF-117", title: "Knowledge article types and data categories", epic: "EP-1", type: "Configuration", points: 5, sprint: 5, status: "Accepted", split: [["jwalker", 100]] },
  { key: "SF-118", title: "API limit monitoring with retry and back-off", epic: "EP-6", type: "Apex", points: 8, sprint: 5, status: "Accepted", split: [["rverma", 100]] },
  { key: "SF-119", title: "External user sharing sets for portal cases", epic: "EP-3", type: "Configuration", points: 13, sprint: 5, status: "Accepted", split: [["kiyer", 70], ["jwalker", 30]] },
  { key: "SF-120", title: "Lead-to-opportunity conversion with referral routing", epic: "EP-10", type: "Flow", points: 8, sprint: 5, status: "Accepted", split: [["skulkarni", 50], ["jwalker", 50]] },
  { key: "SF-121", title: "Unified profile ingestion from core banking", epic: "EP-5", type: "Integration", points: 13, sprint: 5, status: "Accepted", accepted: 6, rejected: { sprint: 5, reason: "Joint account holders not resolved to one profile" }, split: [["rverma", 40], ["adas", 30], ["bfoster", 30]] },
  // Sprint 6
  { key: "SF-122", title: "Error handling and dead-letter queue for core banking events", epic: "EP-6", type: "Integration", points: 8, sprint: 6, status: "Accepted", split: [["rverma", 100]] },
  { key: "SF-123", title: "Shield field audit trail and event monitoring", epic: "EP-8", type: "Configuration", points: 8, sprint: 6, status: "Accepted", split: [["kiyer", 70], ["jwalker", 30]] },
  { key: "SF-124", title: "Forecast categories and collaborative forecasts", epic: "EP-10", type: "Configuration", points: 5, sprint: 6, status: "Accepted", split: [["jwalker", 100]] },
  { key: "SF-125", title: "Portal case submission LWC with document upload", epic: "EP-3", type: "LWC", points: 13, sprint: 6, status: "Accepted", split: [["amehta", 50], ["vsingh", 20], ["jwalker", 30]] },
  // Sprint 7
  { key: "SF-126", title: "Identity resolution match and reconciliation rules", epic: "EP-5", type: "Configuration", points: 8, sprint: 7, status: "Accepted", split: [["adas", 50], ["rverma", 50]] },
  { key: "SF-127", title: "Mock load 3: cases and history, full reconciliation", epic: "EP-7", type: "Migration", points: 13, sprint: 7, status: "Accepted", split: [["adas", 70], ["bfoster", 30]] },
  { key: "SF-128", title: "Skills-based omni-channel routing for wealth clients", epic: "EP-2", type: "Configuration", points: 8, sprint: 7, status: "Accepted", split: [["kiyer", 80], ["vsingh", 20]] },
  { key: "SF-129", title: "Sandbox refresh automation with data masking", epic: "EP-9", type: "Apex", points: 5, sprint: 7, status: "Accepted", split: [["amehta", 100]] },
  { key: "SF-130", title: "Household roll-ups for total relationship balance", epic: "EP-4", type: "Apex", points: 8, sprint: 7, status: "Accepted", split: [["skulkarni", 100]] },
  // Sprint 8 (current)
  { key: "SF-131", title: "Relationship manager assignment on households", epic: "EP-4", type: "Flow", points: 5, sprint: 8, status: "Accepted", split: [["skulkarni", 70], ["jwalker", 30]] },
  { key: "SF-132", title: "Outbound customer update sync to core banking", epic: "EP-6", type: "Integration", points: 13, sprint: 8, status: "Ready for acceptance", readyDaysAgo: 1, split: [["rverma", 70], ["bfoster", 30]] },
  { key: "SF-133", title: "SLA breach warnings on the case console", epic: "EP-2", type: "LWC", points: 5, sprint: 8, status: "Ready for acceptance", readyDaysAgo: 2, split: [["amehta", 70], ["ogrant", 30]] },
  { key: "SF-134", title: "Portal knowledge search and case deflection", epic: "EP-3", type: "LWC", points: 8, sprint: 8, status: "Ready for acceptance", readyDaysAgo: 4, split: [["skulkarni", 50], ["jwalker", 50]] },
  { key: "SF-135", title: "Transaction security policy for report exports", epic: "EP-8", type: "Configuration", points: 5, sprint: 8, status: "Ready for acceptance", readyDaysAgo: 6, split: [["kiyer", 100]] },
  { key: "SF-136", title: "Calculated insight: customer lifetime value", epic: "EP-5", type: "Configuration", points: 8, sprint: 8, status: "In progress", rejected: { sprint: 8, reason: "CLV excludes closed accounts; needs a 24-month look-back" }, split: [["adas", 70], ["jwalker", 30]] },
  { key: "SF-137", title: "Cutover rehearsal runbook and timings", epic: "EP-7", type: "Migration", points: 8, sprint: 8, status: "In progress", split: [["adas", 60], ["vsingh", 40]] },
  { key: "SF-138", title: "UAT scripts for case management", epic: "EP-1", type: "Testing", points: 5, sprint: 8, status: "In progress", split: [["ogrant", 100]] },
  // Backlog
  { key: "SF-139", title: "Opportunity product schedules for lending", epic: "EP-10", type: "Configuration", points: 5, sprint: null, status: "Backlog", split: [["skulkarni", 100]] },
  { key: "SF-140", title: "Nightly Bulk API reconciliation job", epic: "EP-6", type: "Apex", points: 13, sprint: null, status: "Backlog", split: [["rverma", 70], ["bfoster", 30]] },
];

const RAID = [
  { type: "Risk", title: "No named technical lead or solution architect", severity: "High", owner: "Daniel Brooks (Algoworks)", exposure: "Design rework on integration and data model; slower code reviews", status: "Mitigating", mitigation: "Arjun Mehta acting lead; architect requisition open, two interviews this week." },
  { type: "Dependency", title: "Core banking sandbox availability", severity: "Critical", owner: "Ben Foster (Customer)", exposure: "Up to 13 integration points blocked for each day the sandbox is down", status: "Open", mitigation: "Middleware mock service for unit tests; fixed sandbox windows agreed with the bank's platform team." },
  { type: "Risk", title: "Offshore night-shift attrition (US-hours team)", severity: "High", owner: "Daniel Brooks (Algoworks)", exposure: "Losing one developer reduces velocity by about 8 points per sprint", status: "Mitigating", mitigation: "Shift allowance, transport, cross-skilling pairs and two named bench backups." },
  { type: "Issue", title: "Slow story acceptance", severity: "High", owner: "Laura Chen (Customer)", exposure: "Accepted value slips to later sprints; cash flow delayed", status: "Open", mitigation: "Daily 15-minute acceptance huddle; 5-day acceptance window written into the SOW." },
  { type: "Risk", title: "Customer-team resistance to the new vendor's ways of working", severity: "Medium", owner: "Sarah Patel (Customer)", exposure: "Split stories stall; duplicated effort", status: "Mitigating", mitigation: "Joint ceremonies, pairing on split stories, shared definition of done." },
  { type: "Issue", title: "Inherited defects from the previous vendor (62 open at handover)", severity: "High", owner: "Megan Ortiz (Algoworks)", exposure: "About 15% of capacity spent on regression fixes", status: "Mitigating", mitigation: "Triage board; 20 closed so far; regression suite SF-112 runs nightly." },
  { type: "Assumption", title: "Product owner decisions arrive within the 5-day acceptance window", severity: "Medium", owner: "Laura Chen (Customer)", exposure: "If false, billing shifts right by a sprint", status: "Open", mitigation: "Tracked on the acceptance queue countdown." },
  { type: "Dependency", title: "Data Cloud licence provisioning", severity: "Medium", owner: "Sarah Patel (Customer)", exposure: "Identity resolution work cannot reach UAT", status: "Open", mitigation: "Licence order raised with Salesforce account team." },
  { type: "Risk", title: "API daily limit exhaustion during migration loads", severity: "Medium", owner: "Rahul Verma (Algoworks)", exposure: "Integration outages during mock loads", status: "Mitigating", mitigation: "Bulk API for loads; limit monitoring from SF-118." },
  { type: "Assumption", title: "Shield licences in place before the security sprint", severity: "Low", owner: "Sarah Patel (Customer)", exposure: "None, confirmed", status: "Closed", mitigation: "Confirmed in sprint 5." },
] as const;

const ENVIRONMENTS = [
  { name: "Dev", current_release: "R2.2 (in build)", test_coverage_pct: 81, open_defects: 14, health: "Healthy", daysAgo: 0 },
  { name: "QA/SIT", current_release: "R2.1 RC2", test_coverage_pct: 78, open_defects: 9, health: "At risk", daysAgo: 1 },
  { name: "UAT", current_release: "R2.1 RC1", test_coverage_pct: 77, open_defects: 5, health: "Healthy", daysAgo: 3 },
  { name: "Staging", current_release: "R2.0", test_coverage_pct: 79, open_defects: 2, health: "Healthy", daysAgo: 12 },
  { name: "Production", current_release: "R1.9 (inherited)", test_coverage_pct: 72, open_defects: 3, health: "Healthy", daysAgo: 40 },
] as const;

const GATES: [string, string, boolean][] = [
  ["Apex test coverage at least 75% in Staging", "Arjun Mehta", true],
  ["Data migration mock load 3 reconciled", "Ananya Das", true],
  ["Security review: OWD and permission sets", "Kavya Iyer", true],
  ["Core banking end-to-end test passed in QA/SIT", "Rahul Verma", false],
  ["No open Sev-1 or Sev-2 defects", "Vikram Singh", false],
  ["UAT sign-off by product owner", "Laura Chen", false],
  ["Cutover runbook and rollback plan approved", "Daniel Brooks", false],
  ["Change advisory board approval", "Sarah Patel", false],
];

const PLANNED_ROLES = [
  ["algoworks", "Delivery Lead (Program Manager)", "Onshore", 1],
  ["algoworks", "Business Analyst", "Onshore", 1],
  ["algoworks", "Technical Lead / Architect", "Offshore", 1],
  ["algoworks", "Salesforce Developer", "Offshore", 3],
  ["algoworks", "Salesforce Admin / Configurator", "Offshore", 1],
  ["algoworks", "Integration Developer", "Offshore", 1],
  ["algoworks", "Data Migration Specialist", "Offshore", 1],
  ["algoworks", "QA Engineer", "Offshore", 2],
  ["customer", "Product Owner", "Onshore", 1],
  ["customer", "Salesforce Developer", "Onshore", 2],
  ["customer", "QA Analyst", "Onshore", 1],
  ["customer", "Middleware Engineer", "Onshore", 1],
] as const;

const day = 24 * 3600 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function buildSeed(today = new Date()) {
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  // The current sprint started 5 days ago, so it has 9 days left.
  const currentStart = new Date(base.getTime() - 5 * day);
  const sprintStart = (n: number) => new Date(currentStart.getTime() + (n - CURRENT_SPRINT) * SPRINT_DAYS * day);
  const sprintId = (n: number) => uid(3, n);
  const at = (d: Date, hours = 15) => new Date(d.getTime() + hours * 3600 * 1000).toISOString();

  const people = PEOPLE.map((p, i) => ({
    id: uid(1, i + 1),
    name: p.name,
    org: p.org,
    role_title: p.role_title,
    location: p.location,
    region: p.region,
    allocation_pct: p.allocation_pct ?? 100,
    start_sprint: p.start_sprint ?? 1,
    email: p.email ?? null,
  }));
  const person_costs = PEOPLE.flatMap((p, i) =>
    p.org === "algoworks" && p.cost ? [{ person_id: uid(1, i + 1), cost_per_sprint: p.cost }] : [],
  );

  const sprints = Array.from({ length: 9 }, (_, i) => {
    const n = i + 1;
    const start = sprintStart(n);
    const end = new Date(start.getTime() + (SPRINT_DAYS - 3) * day); // two weeks, Monday to Friday
    return {
      id: sprintId(n),
      number: n,
      name: `Sprint ${n}`,
      goal: n === 1 ? "Handover from the previous vendor; stabilise the org" : n === CURRENT_SPRINT ? "Core banking outbound sync and portal knowledge" : null,
      start_date: isoDate(start),
      end_date: isoDate(end),
      status: n < CURRENT_SPRINT ? "closed" : n === CURRENT_SPRINT ? "active" : "planned",
      closed_at: n < CURRENT_SPRINT ? at(end, 22) : null,
    };
  });

  const epics = EPICS.map(([key, name, cloud], i) => ({ id: uid(2, i + 1), key, name, cloud }));
  const epicByKey = new Map<string, (typeof epics)[number]>(epics.map((e) => [e.key, e]));

  const po = personId("lchen");
  const stories = STORIES.map((s, i) => {
    const acceptedSprint = s.status === "Accepted" ? (s.accepted ?? s.sprint!) : null;
    const acceptedAt = acceptedSprint
      ? acceptedSprint === CURRENT_SPRINT
        ? at(new Date(base.getTime() - 2 * day))
        : at(new Date(sprintStart(acceptedSprint).getTime() + (9 + (i % 3)) * day))
      : null;
    const epic = epicByKey.get(s.epic)!;
    return {
      id: uid(4, i + 1),
      key: s.key,
      title: s.title,
      epic_id: epic.id,
      cloud: epic.cloud,
      type: s.type,
      points: s.points,
      status: s.status,
      sprint_id: s.sprint ? sprintId(s.sprint) : null,
      accepted_sprint_id: acceptedSprint ? sprintId(acceptedSprint) : null,
      ready_at: s.readyDaysAgo !== undefined ? at(new Date(base.getTime() - s.readyDaysAgo * day), 14) : null,
      accepted_at: acceptedAt,
      accepted_by: acceptedSprint ? po : null,
      rejection_reason: s.status === "In progress" && s.rejected ? s.rejected.reason : null,
    };
  });

  const assignments = STORIES.flatMap((s, i) =>
    s.split.map(([key, share], j) => ({
      id: uid(5, (i + 1) * 10 + j),
      story_id: uid(4, i + 1),
      person_id: personId(key),
      share_pct: share,
    })),
  );

  let ev = 0;
  const story_events = STORIES.flatMap((s, i) => {
    const out = [];
    const story = stories[i];
    if (s.rejected) {
      out.push({
        id: uid(6, ++ev),
        story_id: story.id,
        kind: "rejected",
        reason: s.rejected.reason,
        actor_person_id: po,
        sprint_id: sprintId(s.rejected.sprint),
        created_at: at(new Date(sprintStart(s.rejected.sprint).getTime() + 6 * day)),
      });
    }
    if (story.accepted_sprint_id) {
      out.push({
        id: uid(6, ++ev),
        story_id: story.id,
        kind: "accepted",
        reason: null,
        actor_person_id: po,
        sprint_id: story.accepted_sprint_id,
        created_at: story.accepted_at!,
      });
    }
    return out;
  });

  // Invoices for every closed sprint, computed by the same billing module the app uses.
  const billingPeople: Person[] = people.map((p) => ({ ...p, org: p.org as Person["org"] }));
  const billingStories = stories as unknown as Story[];
  const invoices = [];
  const invoice_lines: (InvoiceLine & { id: string; invoice_id: string })[] = [];
  for (const sp of sprints.filter((s) => s.status === "closed")) {
    const b = sprintBilling(sp.id, billingStories, assignments as Assignment[], billingPeople, RATE_PER_POINT);
    const status = sp.number <= 5 ? "Paid" : sp.number === 6 ? "Sent" : "Draft";
    const invoiceId = uid(7, sp.number);
    const closedAt = new Date(sp.closed_at!);
    invoices.push({
      id: invoiceId,
      number: `INV-S${String(sp.number).padStart(2, "0")}`,
      sprint_id: sp.id,
      status,
      rate_per_point: RATE_PER_POINT,
      billable_points: b.billablePoints,
      amount: round2(b.revenue),
      created_at: sp.closed_at,
      sent_at: status !== "Draft" ? new Date(closedAt.getTime() + day).toISOString() : null,
      paid_at: status === "Paid" ? new Date(closedAt.getTime() + 20 * day).toISOString() : null,
    });
    b.lines.forEach((l, j) => invoice_lines.push({ id: uid(8, sp.number * 100 + j), invoice_id: invoiceId, ...l }));
  }

  const raid_items = RAID.map((r, i) => ({
    id: uid(9, i + 1),
    ...r,
    description: null,
    due_date: r.status === "Closed" ? null : isoDate(new Date(base.getTime() + (7 + i * 3) * day)),
  }));

  const environments = ENVIRONMENTS.map(({ daysAgo, ...e }, i) => ({
    id: uid(0, 100 + i),
    sort: i + 1,
    ...e,
    last_deploy_at: at(new Date(base.getTime() - daysAgo * day), 2),
  }));
  const releases = [
    { id: uid(0, 201), name: "R2.1 Service Cloud go-live", target_date: isoDate(new Date(base.getTime() + 19 * day)), scope: "Case management, omni-channel routing, entitlements and SLAs, knowledge", status: "In UAT" },
    { id: uid(0, 202), name: "R2.2 Customer portal", target_date: isoDate(new Date(base.getTime() + 47 * day)), scope: "Experience Cloud portal, external sharing, knowledge deflection", status: "Planned" },
  ];
  const release_gates = GATES.map(([name, owner, done], i) => ({
    id: uid(0, 300 + i),
    release_id: releases[0].id,
    sort: i + 1,
    name,
    owner,
    done,
  }));
  const planned_roles = PLANNED_ROLES.map(([org, role_title, region, planned], i) => ({
    id: uid(0, 400 + i),
    org,
    role_title,
    region,
    planned,
  }));

  return {
    program_config: [{ id: 1, program_name: "Salesforce Transformation Program", customer_name: "Customer (sample bank)", rate_per_point: RATE_PER_POINT, currency: "USD", acceptance_window_days: ACCEPTANCE_WINDOW_DAYS }],
    finance_config: [{ id: 1, margin_target_pct: MARGIN_TARGET_PCT }],
    people,
    person_costs,
    sprints,
    epics,
    stories,
    assignments,
    story_events,
    invoices,
    invoice_lines,
    raid_items,
    environments,
    releases,
    release_gates,
    planned_roles,
  };
}

export type SeedRows = ReturnType<typeof buildSeed>;

/** Insert order (parents first). Deletes run in reverse. People are upserted, never deleted. */
export const SEED_TABLES = [
  "program_config",
  "finance_config",
  "people",
  "person_costs",
  "sprints",
  "epics",
  "stories",
  "assignments",
  "story_events",
  "invoices",
  "invoice_lines",
  "raid_items",
  "environments",
  "releases",
  "release_gates",
  "planned_roles",
] as const satisfies readonly (keyof SeedRows)[];
