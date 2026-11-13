import { Info } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReportBlock } from "@/api";
import { RankCellView } from "@/components/ranking/rank-ui";
import { STROKE, axisProps, gridProps, seriesColor, tooltipProps } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";

/** Renders `GET reports/:id` → `document.blocks`, the same content as the PDF. */
export function ReportBlocks({ blocks }: { blocks: ReportBlock[] }) {
  const headings = headingsAbove(blocks);
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => (
        <Block key={index} block={block} first={index === 0} heading={headings[index] ?? null} />
      ))}
    </div>
  );
}

/** The nearest heading above each block: a table has no title of its own, so it's named after it. */
function headingsAbove(blocks: ReportBlock[]): (string | null)[] {
  const headings: (string | null)[] = [];
  let current: string | null = null;
  for (const block of blocks) {
    if (block.kind === "heading") current = block.text;
    headings.push(current);
  }
  return headings;
}

function Block({ block, first, heading }: { block: ReportBlock; first: boolean; heading: string | null }) {
  switch (block.kind) {
    case "heading":
      // Level 1 opens a part of a Full report; level 2 a section.
      return block.level <= 1 ? (
        <h2 className={cn("flex items-center gap-2.5 border-b border-border pb-2 text-lg font-semibold tracking-tight text-foreground", !first && "pt-4")}>
          <span aria-hidden className="h-5 w-1 rounded-full bg-primary" />
          {block.text}
        </h2>
      ) : (
        <h3 className={cn("text-base font-semibold text-foreground", !first && "pt-1")}>{block.text}</h3>
      );
    case "paragraph":
      return <p className={cn("text-sm", block.muted ? "text-muted-foreground" : "text-foreground")}>{block.text}</p>;
    case "kpis":
      return (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {block.items.map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-surface-strong p-3.5">
              <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{item.value}</dd>
              {item.sub ? (
                <dd className={cn("mt-0.5 text-xs font-medium", item.tone === "good" ? "text-success" : item.tone === "bad" ? "text-critical" : "text-muted-foreground")}>
                  {item.sub}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        // Tables of 2–4 columns fit a phone; wider ones keep a minimum width and scroll inside the
        // card, with a shadow on the side that has more (scroll-shadow-x).
        <div
          role="region"
          aria-label={heading ?? "Report table"}
          tabIndex={0}
          className="scroll-shadow-x overflow-x-auto rounded-lg border border-border outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
        >
          <table className={cn("w-full text-sm", block.columns.length >= 5 && "min-w-[480px]")}>
            <thead className="bg-surface-strong">
              <tr className="border-b border-border-strong">
                {block.columns.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className={cn("px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", column.align === "right" ? "text-right" : "text-left")}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={block.highlight?.includes(rowIndex) ? "bg-brand-tint font-medium" : undefined}>
                  {row.map((value, colIndex) => (
                    // Numbers never break ("86/100", "▲ 1.2"); headers may wrap ("vs last year").
                    <td
                      key={colIndex}
                      className={cn("px-3 py-2 tabular-nums text-foreground", block.columns[colIndex]?.align === "right" ? "whitespace-nowrap text-right" : "text-left")}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "line_chart":
      return <LineChartBlock block={block} />;
    case "heatmap":
      return (
        <figure>
          {block.title ? <figcaption className="mb-2 text-sm font-medium text-foreground">{block.title}</figcaption> : null}
          <div className="grid max-w-xs gap-1" style={{ gridTemplateColumns: `repeat(${block.size}, minmax(0, 1fr))` }}>
            {[...block.cells]
              .sort((a, b) => a.row - b.row || a.col - b.col)
              .map((cell) => (
                <RankCellView
                  key={`${cell.row}:${cell.col}`}
                  className="aspect-square w-full"
                  cell={{
                    rank: null,
                    // `!` marks a failed search, `60+` not found.
                    status: cell.bucket === "error" ? "error" : cell.bucket === "not_found" ? "not_found" : "ok",
                    bucket: cell.bucket,
                    display: cell.text,
                  }}
                />
              ))}
          </div>
        </figure>
      );
    case "list":
      return (
        <div>
          {block.title ? <p className="mb-1.5 text-sm font-medium text-foreground">{block.title}</p> : null}
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground marker:text-primary">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      );
    case "unavailable":
      return (
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border-strong bg-surface-strong p-3.5 text-sm">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            {block.title ? <p className="font-medium text-foreground">{block.title}</p> : null}
            <p className="text-muted-foreground">{block.message}</p>
          </div>
        </div>
      );
    case "page_break":
      return <hr className="border-border" />;
    default:
      return null;
  }
}

/** The chart the PDF draws, with the same values listed under it (they must match the PDF exactly). */
function LineChartBlock({ block }: { block: Extract<ReportBlock, { kind: "line_chart" }> }) {
  const data = block.points.map((point) => ({ label: point.label, value: point.value }));
  const plotted = data.filter((point) => point.value !== null).length;
  return (
    <figure className="space-y-2">
      {block.title ? <figcaption className="text-sm font-medium text-foreground">{block.title}</figcaption> : null}
      {plotted >= 2 ? (
        <div className="h-44 w-full" role="img" aria-label={`${block.title ?? "Trend"}: ${data.map((point) => `${point.label} ${point.value ?? "no data"}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis {...axisProps} reversed={Boolean(block.lower_is_better)} allowDecimals width={44} domain={["auto", "auto"]} />
              <Tooltip {...tooltipProps} />
              <Line type="monotone" dataKey="value" name="Value" stroke={seriesColor(0)} strokeWidth={STROKE.main} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      <ol className="flex flex-wrap gap-1.5 text-xs">
        {block.points.map((point) => (
          <li key={point.label} className="rounded-md border border-border bg-card px-2 py-1">
            <span className="text-muted-foreground">{point.label}</span> <span className="font-semibold tabular-nums text-foreground">{point.value ?? "—"}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
