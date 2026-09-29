import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import type { ComparisonRow } from "./competitor-table";

function ComparisonTooltip({ active, payload }: TooltipProps<number, string>) {
  const row = payload?.[0]?.payload as ComparisonRow | undefined;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">{row.name}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        <dt className="text-muted-foreground">Visibility</dt>
        <dd className="text-right font-medium tabular text-foreground">{row.visibility}%</dd>
        <dt className="text-muted-foreground">Mentions</dt>
        <dd className="text-right tabular text-foreground">{row.mentions}</dd>
      </dl>
    </div>
  );
}

/** Horizontal bars: one series (visibility), your business in the brand colour. */
export function CompetitorChart({ rows }: { rows: ComparisonRow[] }) {
  const height = Math.max(160, rows.length * 44 + 24);
  const summary = rows.map((r) => `${r.name} ${r.visibility}%`).join(", ");
  return (
    <div className="w-full" style={{ height }} role="img" aria-label={`AI visibility comparison: ${summary}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={10}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} unit="%" />
          <YAxis
            type="category"
            dataKey="name"
            width={176}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            tickFormatter={(name: string) => (name.length > 24 ? `${name.slice(0, 23)}…` : name)}
          />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<ComparisonTooltip />} />
          <Bar dataKey="visibility" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {rows.map((row) => (
              <Cell key={row.id} fill={row.isOwn ? "var(--primary)" : "var(--chart-3)"} />
            ))}
            <LabelList dataKey="visibility" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
