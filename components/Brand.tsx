// No Algoworks logo file was supplied, so the brand is a plain text wordmark.
export function Wordmark() {
  return <span className="text-lg font-bold tracking-tight text-slate-900">Algoworks</span>;
}

export function CustomerMark() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-slate-500">
        <path d="M10 1 1 5v2h18V5l-9-4ZM3 8h2v7H3V8Zm4 0h2v7H7V8Zm4 0h2v7h-2V8Zm4 0h2v7h-2V8ZM1 16h18v3H1v-3Z" />
      </svg>
      Customer (sample bank)
    </span>
  );
}

export function SampleDataBadge() {
  return (
    <span
      className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900"
      title="All figures, people and stories are fictional sample data. No Jira or external systems are connected."
    >
      Sample data
    </span>
  );
}
