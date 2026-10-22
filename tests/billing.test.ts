import { describe, expect, it } from "vitest";
import {
  applyAcceptance,
  breakEvenPoints,
  indexPeople,
  redactFinancials,
  sprintBilling,
  sprintCost,
  sprintFinancials,
  storyBilling,
  validateShares,
  type Assignment,
  type Person,
  type Story,
} from "@/lib/billing";

const RATE = 900;
const people: Person[] = [
  { id: "aw1", name: "Offshore dev", org: "algoworks", allocation_pct: 100, start_sprint: 1 },
  { id: "aw2", name: "Onshore BA", org: "algoworks", allocation_pct: 50, start_sprint: 1 },
  { id: "aw3", name: "Late joiner", org: "algoworks", allocation_pct: 100, start_sprint: 3 },
  { id: "c1", name: "Customer dev", org: "customer", allocation_pct: 100, start_sprint: 1 },
];
const idx = indexPeople(people);

const story = (over: Partial<Story> = {}): Story => ({
  id: "s1",
  key: "SF-1",
  title: "Story",
  points: 10,
  status: "Accepted",
  sprint_id: "sp1",
  accepted_sprint_id: "sp1",
  ...over,
});
const assign = (storyId: string, ...shares: [string, number][]): Assignment[] =>
  shares.map(([person_id, share_pct]) => ({ story_id: storyId, person_id, share_pct }));

describe("story billing", () => {
  it("bills all points of a 100% Algoworks story", () => {
    const b = storyBilling(story(), assign("s1", ["aw1", 60], ["aw2", 40]), idx, RATE);
    expect(b.algoworksPct).toBe(100);
    expect(b.billablePoints).toBe(10);
    expect(b.customerPoints).toBe(0);
    expect(b.amount).toBe(9000);
  });

  it("bills only the Algoworks share of a 70/30 split", () => {
    const b = storyBilling(story({ points: 13 }), assign("s1", ["aw1", 70], ["c1", 30]), idx, RATE);
    expect(b.algoworksPct).toBe(70);
    expect(b.billablePoints).toBe(9.1);
    expect(b.customerPoints).toBe(3.9);
    expect(b.amount).toBe(8190);
  });

  it("bills zero for a fully customer-delivered story but still counts it as delivered", () => {
    const b = storyBilling(story({ points: 5 }), assign("s1", ["c1", 100]), idx, RATE);
    expect(b.billablePoints).toBe(0);
    expect(b.amount).toBe(0);
    expect(b.customerPoints).toBe(5);
  });

  it("bills zero for an unaccepted story and shows it as awaiting acceptance", () => {
    const b = storyBilling(
      story({ status: "Ready for acceptance", accepted_sprint_id: null }),
      assign("s1", ["aw1", 50], ["c1", 50]),
      idx,
      RATE,
    );
    expect(b.billablePoints).toBe(0);
    expect(b.amount).toBe(0);
    expect(b.awaitingPoints).toBe(5);
    expect(b.awaitingAmount).toBe(4500);
  });

  it("bills nothing for in-progress or backlog work", () => {
    for (const status of ["Backlog", "In progress"] as const) {
      const b = storyBilling(story({ status }), assign("s1", ["aw1", 100]), idx, RATE);
      expect(b.billablePoints + b.awaitingPoints).toBe(0);
    }
  });

  it("rejects assignments whose shares do not total 100", () => {
    expect(validateShares(assign("s1", ["aw1", 70], ["c1", 20])).ok).toBe(false);
    expect(validateShares([]).ok).toBe(false);
    expect(() => storyBilling(story(), assign("s1", ["aw1", 70]), idx, RATE)).toThrow(/total 100/);
  });
});

describe("acceptance workflow", () => {
  it("a rejected-then-accepted story bills once, in the sprint it was accepted", () => {
    const ready = story({ status: "Ready for acceptance", sprint_id: "sp5", accepted_sprint_id: null });
    const rejected = applyAcceptance(ready, { kind: "reject", reason: "Missing SLA field on layout" });
    expect(rejected.status).toBe("In progress");
    expect(rejected.accepted_sprint_id).toBeNull();

    const as = assign("s1", ["aw1", 70], ["c1", 30]);
    // While rejected it bills in no sprint.
    expect(sprintBilling("sp5", [rejected], as, people, RATE).billablePoints).toBe(0);

    const accepted = applyAcceptance({ ...rejected, status: "Ready for acceptance" }, { kind: "accept", sprintId: "sp6" });
    expect(sprintBilling("sp5", [accepted], as, people, RATE).billablePoints).toBe(0);
    expect(sprintBilling("sp6", [accepted], as, people, RATE).billablePoints).toBe(7);
  });

  it("cannot accept a story that is not ready for acceptance", () => {
    expect(() => applyAcceptance(story({ status: "In progress" }), { kind: "accept", sprintId: "sp1" })).toThrow();
  });

  it("requires a reason to reject", () => {
    expect(() =>
      applyAcceptance(story({ status: "Ready for acceptance" }), { kind: "reject", reason: " " }),
    ).toThrow(/reason/);
  });
});

describe("sprint billing and financials", () => {
  const stories: Story[] = [
    story({ id: "a", key: "SF-1", points: 8 }), // 100% Algoworks
    story({ id: "b", key: "SF-2", points: 13 }), // 70/30
    story({ id: "c", key: "SF-3", points: 5 }), // customer only
    story({ id: "d", key: "SF-4", points: 8, status: "Ready for acceptance", accepted_sprint_id: null }),
    story({ id: "e", key: "SF-5", points: 5, sprint_id: "sp1", accepted_sprint_id: "sp2" }), // accepted next sprint
  ];
  const assignments = [
    ...assign("a", ["aw1", 100]),
    ...assign("b", ["aw1", 70], ["c1", 30]),
    ...assign("c", ["c1", 100]),
    ...assign("d", ["aw1", 100]),
    ...assign("e", ["aw1", 100]),
  ];

  it("totals billable points, revenue and per-story invoice lines", () => {
    const sb = sprintBilling("sp1", stories, assignments, people, RATE);
    expect(sb.acceptedPoints).toBe(26);
    expect(sb.billablePoints).toBe(17.1);
    expect(sb.customerPoints).toBe(8.9);
    expect(sb.revenue).toBe(15390);
    expect(sb.lines.map((l) => [l.story_key, l.billable_points])).toEqual([
      ["SF-1", 8],
      ["SF-2", 9.1],
      ["SF-3", 0],
    ]);
  });

  it("bills a story in the sprint it was accepted, not the sprint it was worked", () => {
    expect(sprintBilling("sp2", stories, assignments, people, RATE).billablePoints).toBe(5);
  });

  it("costs only Algoworks people, by allocation and start sprint", () => {
    const costs = [
      { person_id: "aw1", cost_per_sprint: 3000 },
      { person_id: "aw2", cost_per_sprint: 8000 },
      { person_id: "aw3", cost_per_sprint: 2000 },
      { person_id: "c1", cost_per_sprint: 99999 }, // ignored: customer people are never costed
    ];
    expect(sprintCost(1, people, costs)).toBe(7000);
    expect(sprintCost(3, people, costs)).toBe(9000);
  });

  it("reports a loss sprint with break-even above billable points", () => {
    const f = sprintFinancials(7.5, 16650, RATE);
    expect(f.revenue).toBe(6750);
    expect(f.margin).toBe(-9900);
    expect(f.isLoss).toBe(true);
    expect(f.marginPct).toBe(-146.67);
    expect(f.breakEvenPoints).toBe(18.5);
    expect(f.costPerBillablePoint).toBe(2220);
  });

  it("reports a profitable sprint", () => {
    const f = sprintFinancials(30, 20000, RATE);
    expect(f.margin).toBe(7000);
    expect(f.marginPct).toBe(25.93);
    expect(f.isLoss).toBe(false);
    expect(breakEvenPoints(20000, RATE)).toBe(22.22);
  });

  it("handles a sprint with no billable points", () => {
    const f = sprintFinancials(0, 5000, RATE);
    expect(f.marginPct).toBeNull();
    expect(f.costPerBillablePoint).toBeNull();
    expect(f.isLoss).toBe(true);
  });
});

describe("customer redaction", () => {
  it("strips cost and margin fields at any depth", () => {
    const payload = {
      revenue: 100,
      cost: 80,
      margin: 20,
      sprints: [{ billablePoints: 3, costPerBillablePoint: 10, breakEvenPoints: 2, marginPct: 5 }],
    };
    expect(redactFinancials(payload)).toEqual({ revenue: 100, sprints: [{ billablePoints: 3 }] });
    expect(JSON.stringify(redactFinancials(payload))).not.toMatch(/cost|margin|breakEven/i);
  });
});
