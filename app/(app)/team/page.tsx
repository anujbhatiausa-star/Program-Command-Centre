import { Card, PageHeader, PmOnly, Td, Th } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { round2 } from "@/lib/billing";
import { loadFinance, loadProgram } from "@/lib/data";
import { fmtPct, fmtPts, fmtUSD } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Planning assumption for the utilisation column: one person at 100% allocation
// takes about 10 story points (share-weighted) per two-week sprint.
const POINTS_PER_SPRINT_AT_FULL = 10;

export default async function TeamPage() {
  const viewer = await requirePage("/team");
  const db = await createClient();
  const [{ data, stories, people: allPeople }, finance, { data: planned }] = await Promise.all([
    loadProgram(db),
    loadFinance(db, viewer),
    db.from("planned_roles").select("*").order("role_title"),
  ]);
  const isPm = viewer.role === "pm";
  const current = data.sprints.find((s) => s.status === "active");
  const storyById = new Map(stories.map((s) => [s.id, s]));
  const costOf = new Map((finance?.costs ?? []).map((c) => [c.person_id, c.cost_per_sprint]));

  const stats = new Map<string, { delivered: number; load: number }>();
  for (const a of data.assignments) {
    const s = storyById.get(a.story_id);
    if (!s) continue;
    const st = stats.get(a.person_id) ?? { delivered: 0, load: 0 };
    const pts = (s.points * a.share_pct) / 100;
    if (s.status === "Accepted") st.delivered += pts;
    if (s.sprint_id === current?.id) st.load += pts;
    stats.set(a.person_id, st);
  }

  const groups = [
    { org: "algoworks", title: "Algoworks" },
    { org: "customer", title: "Customer (sample bank)" },
  ] as const;

  return (
    <>
      <PageHeader title="Team" subtitle="Algoworks onshore and offshore (India, US hours) team alongside the customer's own people" />
      <div className="space-y-4">
        {groups.map((g) => {
          const people = allPeople.filter((p) => p.org === g.org);
          return (
            <Card
              key={g.org}
              title={`${g.title}: ${people.length} people`}
              info={`Delivered = share-weighted accepted points to date. Load = share-weighted points in ${current?.name ?? "the current sprint"}. Utilisation = load ÷ (${POINTS_PER_SPRINT_AT_FULL} points × allocation).`}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr>
                      <Th>Name</Th>
                      <Th>Role</Th>
                      <Th>Location</Th>
                      <Th className="text-right">Allocation</Th>
                      <Th className="text-right">Delivered pts</Th>
                      <Th className="text-right">Sprint load</Th>
                      <Th className="text-right">Utilisation</Th>
                      {isPm && g.org === "algoworks" && (
                        <>
                          <Th className="text-right">Cost / sprint</Th>
                          <Th className="text-right">Cost to program</Th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {people.map((p) => {
                      const st = stats.get(p.id) ?? { delivered: 0, load: 0 };
                      const capacity = (POINTS_PER_SPRINT_AT_FULL * p.allocation_pct) / 100;
                      const util = capacity ? round2((st.load / capacity) * 100) : null;
                      return (
                        <tr key={p.id}>
                          <Td className="whitespace-nowrap font-medium">{p.name}</Td>
                          <Td>{p.role_title}</Td>
                          <Td className="text-xs">
                            {p.location}
                            <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-600">{p.region}</span>
                          </Td>
                          <Td className="text-right tabular-nums">{p.allocation_pct}%</Td>
                          <Td className="text-right tabular-nums">{fmtPts(st.delivered)}</Td>
                          <Td className="text-right tabular-nums">{fmtPts(st.load)}</Td>
                          <Td className={`text-right tabular-nums ${util != null && util > 110 ? "font-medium text-red-700" : ""}`}>{fmtPct(util)}</Td>
                          {isPm && g.org === "algoworks" && (
                            <>
                              <Td className="text-right tabular-nums">{fmtUSD(costOf.get(p.id) ?? 0)}</Td>
                              <Td className="text-right tabular-nums">{fmtUSD(((costOf.get(p.id) ?? 0) * p.allocation_pct) / 100)}</Td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {isPm && g.org === "algoworks" && (
                <p className="mt-2 text-xs text-slate-600">
                  Cost columns <PmOnly />
                </p>
              )}
            </Card>
          );
        })}

        <Card title="Planned versus filled roles" info="Roles in the staffing plan against people currently on the program with that role title.">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <Th>Role</Th>
                  <Th>Organisation</Th>
                  <Th>Where</Th>
                  <Th className="text-right">Planned</Th>
                  <Th className="text-right">Filled</Th>
                  <Th className="text-right">Gap</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(planned ?? []).map((r) => {
                  const filled = allPeople.filter((p) => p.org === r.org && p.role_title === r.role_title).length;
                  const gap = r.planned - filled;
                  return (
                    <tr key={r.id}>
                      <Td className="font-medium">{r.role_title}</Td>
                      <Td>{r.org === "algoworks" ? "Algoworks" : "Customer"}</Td>
                      <Td>{r.region}</Td>
                      <Td className="text-right tabular-nums">{r.planned}</Td>
                      <Td className="text-right tabular-nums">{filled}</Td>
                      <Td className={`text-right tabular-nums ${gap > 0 ? "font-semibold text-red-700" : "text-slate-500"}`}>
                        {gap > 0 ? `${gap} open` : "–"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
