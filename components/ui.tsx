import { useId, type ReactNode } from "react";
import { fmtPct } from "@/lib/format";

export function Card({ title, info, children, className = "", actions }: { title?: string; info?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              {title}
              {info && <InfoTip label={title} text={info} />}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Keyboard- and hover-accessible definition tooltip. */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-describedby={id}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-6 z-30 w-64 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function Tile({ label, value, sub, info, tone = "default", children }: { label: string; value: ReactNode; sub?: ReactNode; info: string; tone?: "default" | "good" | "warn" | "bad"; children?: ReactNode }) {
  const toneCls = { default: "text-slate-900", good: "text-emerald-700", warn: "text-amber-700", bad: "text-red-700" }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        <InfoTip label={label} text={info} />
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-600">{sub}</div>}
      {children}
    </div>
  );
}

const BADGE: Record<string, string> = {
  Paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Sent: "bg-blue-50 text-blue-800 ring-blue-200",
  Draft: "bg-slate-100 text-slate-700 ring-slate-300",
  Critical: "bg-red-50 text-red-800 ring-red-200",
  High: "bg-orange-50 text-orange-800 ring-orange-200",
  Medium: "bg-amber-50 text-amber-800 ring-amber-200",
  Low: "bg-slate-100 text-slate-700 ring-slate-300",
  Open: "bg-red-50 text-red-800 ring-red-200",
  Mitigating: "bg-amber-50 text-amber-800 ring-amber-200",
  Closed: "bg-slate-100 text-slate-600 ring-slate-300",
  Healthy: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "At risk": "bg-amber-50 text-amber-800 ring-amber-200",
  Blocked: "bg-red-50 text-red-800 ring-red-200",
};

export function Badge({ children, kind }: { children: ReactNode; kind?: string }) {
  const cls = BADGE[kind ?? String(children)] ?? "bg-slate-100 text-slate-700 ring-slate-300";
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{children}</span>;
}

/** Algoworks vs customer share of a story; labelled so colour is never the only cue. */
export function SplitBar({ algoworksPct, showLabel = true }: { algoworksPct: number; showLabel?: boolean }) {
  const cust = 100 - algoworksPct;
  return (
    <div>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Algoworks ${fmtPct(algoworksPct)}, customer ${fmtPct(cust)}`}
      >
        {algoworksPct > 0 && <div className="h-full bg-algo" style={{ width: `${algoworksPct}%` }} />}
        {algoworksPct > 0 && cust > 0 && <div className="h-full w-0.5 bg-white" />}
        {cust > 0 && <div className="h-full bg-cust" style={{ width: `${cust}%` }} />}
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-[11px] text-slate-600">
          <span>Algoworks {fmtPct(algoworksPct)}</span>
          <span>Customer {fmtPct(cust)}</span>
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th scope="col" className={`whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}>{children}</th>;
}
export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top text-sm text-slate-800 ${className}`}>{children}</td>;
}

export function PmOnly() {
  return <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">PM only</span>;
}
