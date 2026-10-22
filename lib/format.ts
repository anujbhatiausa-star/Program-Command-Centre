const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pts = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export const fmtUSD = (n: number) => usd.format(n);
export const fmtPts = (n: number) => pts.format(n);
export const fmtPct = (n: number | null | undefined) => (n == null ? "–" : `${pts.format(n)}%`);
export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "–";
