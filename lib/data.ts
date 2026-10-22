import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assignment, Person, Story } from "./billing";
import type { FinanceData, Invoice, ProgramData, RaidItem, Sprint, StoryEvent } from "./metrics";
import type { Viewer } from "./auth";

const num = (v: unknown) => Number(v ?? 0);

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Could not load ${what}: ${res.error.message}`);
  return res.data as T;
}

/** A story with the display fields the pages need (billing only needs `Story`). */
export interface StoryRow extends Story {
  cloud: string;
  type: string;
  epic_id: string | null;
  ready_at: string | null;
  accepted_at: string | null;
  rejection_reason: string | null;
}

export interface PersonRow extends Person {
  role_title: string;
  location: string;
  region: "Onshore" | "Offshore";
}

export interface ProgramConfig {
  program_name: string;
  customer_name: string;
  rate_per_point: number;
  currency: string;
  acceptance_window_days: number;
}

export async function loadConfig(db: SupabaseClient): Promise<ProgramConfig> {
  const c = must(await db.from("program_config").select("*").single(), "config") as ProgramConfig;
  return { ...c, rate_per_point: num(c.rate_per_point) };
}

/** Customer-visible program data (RLS: any signed-in user). */
export async function loadProgram(db: SupabaseClient) {
  const [config, sprints, stories, assignments, people, invoices, events, raid] = await Promise.all([
    loadConfig(db),
    db.from("sprints").select("*").order("number"),
    db.from("stories").select("*").order("key"),
    db.from("assignments").select("story_id, person_id, share_pct"),
    db.from("people").select("*").order("name"),
    db.from("invoices").select("*"),
    db.from("story_events").select("story_id, kind"),
    db.from("raid_items").select("type, severity, status"),
  ]);
  const storyRows = (must(stories, "stories") as StoryRow[]).map((s) => ({ ...s, points: num(s.points) }));
  const data: ProgramData = {
    ratePerPoint: config.rate_per_point,
    sprints: must(sprints, "sprints") as Sprint[],
    stories: storyRows,
    assignments: (must(assignments, "assignments") as Assignment[]).map((a) => ({ ...a, share_pct: num(a.share_pct) })),
    people: must(people, "people") as PersonRow[],
    invoices: (must(invoices, "invoices") as Invoice[]).map((i) => ({
      ...i,
      amount: num(i.amount),
      billable_points: num(i.billable_points),
      rate_per_point: num(i.rate_per_point),
    })),
    events: must(events, "story events") as StoryEvent[],
    raid: must(raid, "RAID") as RaidItem[],
  };
  return { config, data, stories: storyRows, people: data.people as PersonRow[] };
}

/** Cost and margin inputs. Only ever called for the PM; RLS returns nothing to anyone else. */
export async function loadFinance(db: SupabaseClient, viewer: Viewer): Promise<FinanceData | null> {
  if (viewer.role !== "pm") return null;
  const [costs, fin] = await Promise.all([
    db.from("person_costs").select("person_id, cost_per_sprint"),
    db.from("finance_config").select("margin_target_pct").single(),
  ]);
  return {
    costs: (must(costs, "costs") as { person_id: string; cost_per_sprint: number }[]).map((c) => ({
      ...c,
      cost_per_sprint: num(c.cost_per_sprint),
    })),
    marginTargetPct: num(must(fin, "finance config")?.margin_target_pct),
  };
}
