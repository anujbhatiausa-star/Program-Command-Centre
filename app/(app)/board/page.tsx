import { ActionButton } from "@/components/ActionButton";
import { FilterBar } from "@/components/FilterBar";
import { PageHeader, SplitBar } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { algoworksPct, groupAssignments, indexPeople, type StoryStatus } from "@/lib/billing";
import { loadProgram } from "@/lib/data";
import { fmtPts } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const COLUMNS: StoryStatus[] = ["Backlog", "In progress", "Ready for acceptance", "Accepted"];
const NEXT: Partial<Record<StoryStatus, StoryStatus>> = {
  Backlog: "In progress",
  "In progress": "Ready for acceptance",
};

export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("/board");
  const { cloud = "", org = "", sprint = "" } = await searchParams;
  const db = await createClient();
  const { data, stories: allStories } = await loadProgram(db);
  const { data: epics } = await db.from("epics").select("id, name");
  const epicName = new Map((epics ?? []).map((e) => [e.id, e.name]));
  const people = indexPeople(data.people);
  const byStory = groupAssignments(data.assignments);
  const current = data.sprints.find((s) => s.status === "active");
  const sprintName = new Map(data.sprints.map((s) => [s.id, s.name]));
  const clouds = [...new Set(allStories.map((s) => s.cloud))].sort();

  const stories = allStories
    .map((s) => ({ ...s, pct: algoworksPct(byStory.get(s.id) ?? [], people) }))
    .filter((s) => !cloud || s.cloud === cloud)
    .filter((s) =>
      org === "algoworks" ? s.pct === 100 : org === "customer" ? s.pct === 0 : org === "split" ? s.pct > 0 && s.pct < 100 : true,
    )
    .filter((s) => (sprint === "all" ? true : sprint ? s.sprint_id === sprint : s.sprint_id === current?.id || s.status === "Backlog"));

  return (
    <>
      <PageHeader
        title="Backlog and board"
        subtitle={`${sprint === "all" ? "All sprints" : sprintName.get(sprint) ?? `${current?.name ?? "Current sprint"} and backlog`} · ${stories.length} stories · ${fmtPts(stories.reduce((s, x) => s + x.points, 0))} points`}
        actions={
          <FilterBar
            filters={[
              {
                name: "sprint",
                label: "Sprint",
                options: [
                  { value: "", label: "Current sprint + backlog" },
                  { value: "all", label: "All sprints" },
                  ...data.sprints.filter((s) => s.status !== "planned").map((s) => ({ value: s.id, label: s.name })),
                ],
              },
              { name: "cloud", label: "Cloud / area", options: [{ value: "", label: "All clouds" }, ...clouds.map((c) => ({ value: c, label: c }))] },
              {
                name: "org",
                label: "Delivered by",
                options: [
                  { value: "", label: "Everyone" },
                  { value: "algoworks", label: "Algoworks only" },
                  { value: "split", label: "Split Algoworks / customer" },
                  { value: "customer", label: "Customer only" },
                ],
              },
            ]}
          />
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = stories.filter((s) => s.status === col);
          return (
            <section key={col} aria-labelledby={`col-${col}`} className="rounded-lg bg-slate-100 p-3">
              <h2 id={`col-${col}`} className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-800">
                {col}
                <span className="text-xs font-normal text-slate-600">
                  {cards.length} · {fmtPts(cards.reduce((s, c) => s + c.points, 0))} pts
                </span>
              </h2>
              <ul className="space-y-2">
                {cards.map((s) => (
                  <li key={s.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs text-slate-500">{s.key}</span>
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white" aria-label={`${s.points} points`}>
                        {s.points} pts
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-900">{s.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">{s.cloud}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">{s.type}</span>
                      {s.sprint_id && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">{sprintName.get(s.sprint_id)}</span>}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-500" title={epicName.get(s.epic_id ?? "")}>
                      {epicName.get(s.epic_id ?? "")}
                    </p>
                    <div className="mt-2">
                      <SplitBar algoworksPct={s.pct} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {(byStory.get(s.id) ?? []).map((a) => `${people.get(a.person_id)?.name.split(" ")[0]} ${a.share_pct}%`).join(" · ")}
                    </p>
                    {s.rejection_reason && s.status === "In progress" && (
                      <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">Rejected: {s.rejection_reason}</p>
                    )}
                    {NEXT[s.status] && (
                      <div className="mt-2">
                        <ActionButton
                          url={`/api/stories/${s.id}/advance`}
                          label={`Move to ${NEXT[s.status]}`}
                          className="btn-secondary w-full !py-1 text-xs"
                        />
                      </div>
                    )}
                  </li>
                ))}
                {cards.length === 0 && <li className="rounded-md border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">No stories</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
