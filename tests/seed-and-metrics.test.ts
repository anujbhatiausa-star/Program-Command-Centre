import { describe, expect, it } from "vitest";
import { groupAssignments, round2, validateShares, type Person, type Story } from "@/lib/billing";
import { buildOverview, type ProgramData } from "@/lib/metrics";
import { buildSeed, MARGIN_TARGET_PCT } from "@/lib/seed-data";

const seed = buildSeed(new Date("2026-10-22T12:00:00Z"));
const data: ProgramData = {
  ratePerPoint: seed.program_config[0].rate_per_point,
  sprints: seed.sprints as ProgramData["sprints"],
  stories: seed.stories as unknown as Story[],
  assignments: seed.assignments,
  people: seed.people as Person[],
  invoices: seed.invoices as ProgramData["invoices"],
  events: seed.story_events as ProgramData["events"],
  raid: seed.raid_items as unknown as ProgramData["raid"],
};
const finance = { costs: seed.person_costs, marginTargetPct: MARGIN_TARGET_PCT };

describe("sample data", () => {
  it("every story's shares total 100", () => {
    const byStory = groupAssignments(seed.assignments);
    for (const s of seed.stories) expect(validateShares(byStory.get(s.id) ?? []).ok, s.key).toBe(true);
  });

  it("covers the scenarios the demo relies on", () => {
    const statuses = seed.stories.map((s) => s.status);
    expect(statuses.filter((s) => s === "Ready for acceptance")).toHaveLength(4);
    expect(seed.stories.filter((s) => s.rejection_reason)).toHaveLength(1);
    expect(seed.sprints.filter((s) => s.status === "active")).toHaveLength(1);
    // Only Algoworks people carry cost.
    const algoworks = new Set(seed.people.filter((p) => p.org === "algoworks").map((p) => p.id));
    expect(seed.person_costs.every((c) => algoworks.has(c.person_id))).toBe(true);
  });

  it("invoice totals equal the sum of their per-story lines", () => {
    for (const inv of seed.invoices) {
      const lines = seed.invoice_lines.filter((l) => l.invoice_id === inv.id);
      expect(round2(lines.reduce((s, l) => s + l.amount, 0))).toBe(inv.amount);
      expect(round2(lines.reduce((s, l) => s + l.billable_points, 0))).toBe(inv.billable_points);
    }
  });

  it("has a handover sprint that ran at a loss", () => {
    const o = buildOverview(data, finance);
    expect(o.sprints[0].isLoss).toBe(true);
    expect(o.sprints[0].billablePoints).toBeLessThan(o.sprints[0].breakEvenPoints!);
  });
});

describe("overview for customer users", () => {
  it("contains no cost or margin data at all", () => {
    const o = buildOverview(data, null);
    expect(JSON.stringify(o)).not.toMatch(/cost|margin|breakEven|isLoss/i);
    expect(o.revenueToDate).toBeGreaterThan(0);
  });

  it("cash at risk = awaiting acceptance value + sent, unpaid invoices", () => {
    const o = buildOverview(data, null);
    const sent = seed.invoices.filter((i) => i.status === "Sent").reduce((s, i) => s + i.amount, 0);
    expect(o.cashAtRisk).toBe(round2(o.awaitingAmount + sent));
    expect(o.awaitingAmount).toBe(round2(o.awaitingPoints * data.ratePerPoint));
  });
});
