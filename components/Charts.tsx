"use client";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COLORS } from "@/lib/colors";
import { fmtPct, fmtPts } from "@/lib/format";

const ALGO = COLORS.algoworks;
const REF = COLORS.reference;
const GRID = "#e2e8f0";
const AXIS = { fontSize: 12, fill: "#475569" };

export interface MarginPoint {
  sprint: string;
  marginPct: number | null;
}
export interface Series {
  key: string;
  name: string;
  color: string;
}

// Legend text stays in ink; the swatch carries the series colour.
const legendText = (v: string) => <span style={{ color: "#334155" }}>{v}</span>;

const fmtTooltip = (v: unknown, name: unknown) => [fmtPts(Number(v)) + " pts", String(name)] as [string, string];

/** Stacked points per sprint. An optional dashed reference series (break-even) for the PM. */
export function StackedPointsChart({
  data,
  series,
  reference,
}: {
  data: Record<string, string | number>[];
  series: Series[];
  reference?: { key: string; name: string };
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="sprint" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip formatter={fmtTooltip} cursor={{ fill: "#f1f5f9" }} itemStyle={{ color: "#0f172a" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId="pts"
            fill={s.color}
            stroke="#fff"
            strokeWidth={1}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
        {reference && (
          <Line dataKey={reference.key} name={reference.name} stroke={REF} strokeWidth={2} strokeDasharray="5 4" dot={false} type="monotone" />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Margin % per closed sprint against the target (PM only). */
const MARGIN_FLOOR = -50;

export function MarginChart({ data, target }: { data: MarginPoint[]; target: number }) {
  const clipped = data.filter((d) => d.marginPct != null && d.marginPct < MARGIN_FLOOR);
  return (
    <>
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="sprint" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} unit="%" domain={[MARGIN_FLOOR, 60]} allowDataOverflow ticks={[-50, -25, 0, 25, 50]} />
        <Tooltip formatter={(v) => [fmtPct(Number(v)), "Margin"]} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <ReferenceLine
          y={target}
          stroke={REF}
          strokeDasharray="5 4"
          strokeWidth={2}
          label={{ value: `Target ${target}%`, position: "insideTopRight", fontSize: 11, fill: REF }}
        />
        <Line dataKey="marginPct" name="Margin %" stroke={ALGO} strokeWidth={2} dot={{ r: 4, fill: ALGO, stroke: "#fff", strokeWidth: 2 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
    {clipped.length > 0 && (
      <p className="mt-1 text-xs text-slate-600">
        Below the axis: {clipped.map((d) => `${d.sprint} ${fmtPct(d.marginPct)}`).join(", ")}. See the sprint summary.
      </p>
    )}
    </>
  );
}
