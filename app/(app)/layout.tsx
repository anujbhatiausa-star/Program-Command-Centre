import { redirect } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { CustomerMark, SampleDataBadge, Wordmark } from "@/components/Brand";
import { LiveUpdates } from "@/components/LiveUpdates";
import { Nav, SignOut } from "@/components/Nav";
import { getViewer } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Wordmark />
              <span className="hidden h-5 w-px bg-slate-300 sm:block" aria-hidden="true" />
              <span className="text-sm font-semibold text-slate-800">Program Command Center</span>
              <span className="hidden text-slate-300 sm:inline" aria-hidden="true">·</span>
              <CustomerMark />
              <SampleDataBadge />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LiveUpdates />
              <span className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">{ROLE_LABEL[viewer.role]}</span>
                <span className="hidden md:inline"> · {viewer.email}</span>
              </span>
              {viewer.role === "pm" && (
                <ActionButton
                  url="/api/admin/reset"
                  label="Reset demo data"
                  confirm="Reset all sample data to its starting state? Demo logins are kept."
                  className="btn-danger"
                />
              )}
              <SignOut />
            </div>
          </div>
          <Nav role={viewer.role} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
