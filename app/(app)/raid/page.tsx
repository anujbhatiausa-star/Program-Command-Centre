import { RaidControls, RaidStatus } from "@/components/RaidControls";
import { Badge, Card, PageHeader, Td, Th } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["Risk", "Issue", "Assumption", "Dependency"] as const;
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 } as Record<string, number>;

export default async function RaidPage() {
  const viewer = await requirePage("/raid");
  const db = await createClient();
  const { data } = await db.from("raid_items").select("*");
  const items = (data ?? []).sort(
    (a, b) => Number(a.status === "Closed") - Number(b.status === "Closed") || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  const isPm = viewer.role === "pm";

  return (
    <>
      <PageHeader
        title="RAID log"
        subtitle="Risks, assumptions, issues and dependencies for the program"
        actions={isPm ? <RaidControls /> : undefined}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {TYPES.map((t) => {
          const open = items.filter((i) => i.type === t && i.status !== "Closed");
          return (
            <div key={t} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">{t === "Dependency" ? "Dependencies" : `${t}s`}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{open.length} open</div>
              <div className="text-xs text-slate-600">
                {open.filter((i) => i.severity === "High" || i.severity === "Critical").length} high or critical
              </div>
            </div>
          );
        })}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Item</Th>
                <Th>Severity</Th>
                <Th>Owner</Th>
                <Th>Exposure</Th>
                <Th>Status</Th>
                <Th>Due</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.id} className={i.status === "Closed" ? "opacity-60" : ""}>
                  <Td className="whitespace-nowrap text-xs font-medium text-slate-600">{i.type}</Td>
                  <Td className="min-w-[16rem]">
                    <div className="font-medium">{i.title}</div>
                    {i.mitigation && <div className="mt-0.5 text-xs text-slate-600">Response: {i.mitigation}</div>}
                  </Td>
                  <Td>
                    <Badge>{i.severity}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{i.owner}</Td>
                  <Td className="min-w-[12rem] text-xs">{i.exposure}</Td>
                  <Td>{isPm ? <RaidStatus id={i.id} status={i.status} /> : <Badge>{i.status}</Badge>}</Td>
                  <Td className="whitespace-nowrap text-xs">{fmtDate(i.due_date)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
