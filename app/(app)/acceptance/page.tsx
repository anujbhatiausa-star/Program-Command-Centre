import { AcceptanceActions } from "@/components/AcceptanceActions";
import { Card, PageHeader, SplitBar } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { groupAssignments, indexPeople, storyBilling } from "@/lib/billing";
import { loadProgram } from "@/lib/data";
import { fmtDate, fmtPts, fmtUSD } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const DAY = 24 * 3600 * 1000;

function countdown(readyAt: string | null, windowDays: number) {
  if (!readyAt) return { text: "–", tone: "text-slate-600" };
  const due = new Date(readyAt).getTime() + windowDays * DAY;
  const days = Math.ceil((due - Date.now()) / DAY);
  if (days < 0) return { text: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, tone: "text-red-700 bg-red-50" };
  if (days <= 1) return { text: days === 0 ? "Due today" : "1 day left", tone: "text-amber-800 bg-amber-50" };
  return { text: `${days} days left`, tone: "text-emerald-800 bg-emerald-50" };
}

export default async function AcceptancePage() {
  const viewer = await requirePage("/acceptance");
  const db = await createClient();
  const { config, data, stories } = await loadProgram(db);
  const people = indexPeople(data.people);
  const byStory = groupAssignments(data.assignments);
  const queue = stories
    .filter((s) => s.status === "Ready for acceptance")
    .sort((a, b) => (a.ready_at ?? "").localeCompare(b.ready_at ?? ""))
    .map((s) => ({ s, b: storyBilling(s, byStory.get(s.id) ?? [], people, config.rate_per_point) }));
  const total = queue.reduce((t, q) => t + q.b.awaitingAmount, 0);
  const canDecide = viewer.role === "product_owner";

  return (
    <>
      <PageHeader
        title="Acceptance queue"
        subtitle={`${queue.length} stories ready for acceptance · ${fmtUSD(total)} of Algoworks work awaiting your decision · acceptance window ${config.acceptance_window_days} days`}
      />
      {!canDecide && (
        <p className="mb-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          Read-only view. Only the customer product owner can accept or reject stories (enforced in the database).
        </p>
      )}
      {queue.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">Nothing waiting. Every delivered story has been decided.</p>
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {queue.map(({ s, b }) => {
            const cd = countdown(s.ready_at, config.acceptance_window_days);
            return (
              <li key={s.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-slate-500">{s.key}</span>
                    <h2 className="text-sm font-semibold text-slate-900">{s.title}</h2>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {s.cloud} · {s.type} · ready since {fmtDate(s.ready_at)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cd.tone}`}>{cd.text}</span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Story points</dt>
                    <dd className="font-semibold tabular-nums">{s.points}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Billable if accepted</dt>
                    <dd className="font-semibold tabular-nums">{fmtPts(b.awaitingPoints)} pts</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Amount</dt>
                    <dd className="font-semibold tabular-nums">{fmtUSD(b.awaitingAmount)}</dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <SplitBar algoworksPct={b.algoworksPct} />
                </div>
                {canDecide && <AcceptanceActions storyId={s.id} storyKey={s.key} />}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
