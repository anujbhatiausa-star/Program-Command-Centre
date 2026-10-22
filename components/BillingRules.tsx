import { fmtUSD } from "@/lib/format";

export function BillingRules({ rate, windowDays }: { rate: number; windowDays: number }) {
  return (
    <section aria-labelledby="rules" className="rounded-lg border border-blue-200 bg-accent-soft p-4 text-sm text-slate-800">
      <h2 id="rules" className="mb-2 font-semibold text-slate-900">How billing works, in plain language</h2>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Every story has story points and one or more people assigned, each with a share. Shares add up to 100%.</li>
        <li>Each person works for either Algoworks or the customer.</li>
        <li>
          Algoworks bills only its own share: <strong>billable points = story points × Algoworks share</strong>. A 13-point story split
          70/30 bills 9.1 points. The customer&apos;s share is shown as delivered capacity but never billed.
        </li>
        <li>
          A story bills only after the customer&apos;s product owner <strong>accepts</strong> it (target: within {windowDays} days).
          Delivered but unaccepted points earn nothing. A rejected story goes back to In progress.
        </li>
        <li>An accepted story bills in the sprint in which it was accepted.</li>
        <li>
          <strong>Amount = billable points × {fmtUSD(rate)}</strong> per point.
        </li>
        <li>When a sprint closes, a draft invoice is created for its billable points. Invoices move Draft → Sent → Paid.</li>
      </ol>
    </section>
  );
}
