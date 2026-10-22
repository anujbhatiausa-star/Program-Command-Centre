import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, InfoTip, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const MIN_COVERAGE = 75; // Salesforce requires 75% Apex coverage to deploy to production

export default async function ReleasesPage() {
  const viewer = await requirePage("/releases");
  const db = await createClient();
  const [{ data: envs }, { data: releases }, { data: gates }] = await Promise.all([
    db.from("environments").select("*").order("sort"),
    db.from("releases").select("*").order("target_date"),
    db.from("release_gates").select("*").order("sort"),
  ]);
  const isPm = viewer.role === "pm";

  return (
    <>
      <PageHeader title="Release readiness" subtitle="Environments from Dev to Production, and the go/no-go gate for the next release" />
      <Card title="Environments" info={`Current release, Apex test coverage (Salesforce needs at least ${MIN_COVERAGE}% to deploy to production) and open defects in each org.`}>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(envs ?? []).map((e, i) => (
            <li key={e.id} className="relative rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  <span className="mr-1 text-xs text-slate-400">{i + 1}.</span>
                  {e.name}
                </h3>
                <Badge>{e.health}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-800">{e.current_release}</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Test coverage</span>
                  <span className={`tabular-nums ${e.test_coverage_pct < MIN_COVERAGE ? "font-semibold text-red-700" : ""}`}>{e.test_coverage_pct}%</span>
                </div>
                <div className="relative mt-1 h-1.5 rounded-full bg-slate-100" role="img" aria-label={`Coverage ${e.test_coverage_pct}%, minimum ${MIN_COVERAGE}%`}>
                  <div className={`h-full rounded-full ${e.test_coverage_pct < MIN_COVERAGE ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${e.test_coverage_pct}%` }} />
                  <div className="absolute -top-0.5 h-2.5 w-0.5 bg-slate-700" style={{ left: `${MIN_COVERAGE}%` }} />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-1 text-xs">
                <dt className="text-slate-500">Open defects</dt>
                <dd className="text-right font-medium tabular-nums">{e.open_defects}</dd>
                <dt className="text-slate-500">Last deploy</dt>
                <dd className="text-right">{fmtDate(e.last_deploy_at)}</dd>
              </dl>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(releases ?? []).map((r) => {
          const rg = (gates ?? []).filter((g) => g.release_id === r.id);
          const done = rg.filter((g) => g.done).length;
          const go = rg.length > 0 && done === rg.length;
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{r.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Target {fmtDate(r.target_date)} · {r.status}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{r.scope}</p>
                </div>
                {rg.length > 0 && (
                  <span className={`rounded-md px-3 py-1 text-sm font-semibold ${go ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
                    {go ? "GO" : "NO-GO"}
                  </span>
                )}
              </div>
              {rg.length > 0 ? (
                <>
                  <h3 className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Go/no-go gates: {done} of {rg.length} passed
                    <InfoTip label="go/no-go" text="The release is GO only when every gate is passed. The PM records gate results." />
                  </h3>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {rg.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span className="flex items-start gap-2">
                          <span aria-hidden="true" className={g.done ? "text-emerald-600" : "text-slate-400"}>
                            {g.done ? "✔" : "○"}
                          </span>
                          <span>
                            {g.name}
                            <span className="block text-xs text-slate-500">
                              {g.owner} · {g.done ? "Passed" : "Not yet passed"}
                            </span>
                          </span>
                        </span>
                        {isPm && (
                          <ActionButton
                            url={`/api/gates/${g.id}`}
                            body={{ done: !g.done }}
                            label={g.done ? "Reopen" : "Mark passed"}
                            className="btn-secondary !py-1 text-xs"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-600">Gates are defined when the release enters UAT.</p>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
