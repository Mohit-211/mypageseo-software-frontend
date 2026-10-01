import type { ReportBlock } from "@/api";
import { RankCellView } from "@/components/ranking/rank-ui";
import { cn } from "@/lib/utils";

/** Renders `GET reports/:id` → `document.blocks`, the same content as the PDF. */
export function ReportBlocks({ blocks }: { blocks: ReportBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case "heading":
      return block.level <= 1 ? (
        <h2 className="border-b border-border pb-1 text-lg font-semibold text-foreground">{block.text}</h2>
      ) : (
        <h3 className="text-sm font-semibold text-foreground">{block.text}</h3>
      );
    case "paragraph":
      return <p className={cn("text-sm", block.muted ? "text-muted-foreground" : "text-foreground")}>{block.text}</p>;
    case "kpis":
      return (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {block.items.map((item) => (
            <div key={item.label} className="rounded-md border border-border bg-surface p-3">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular text-foreground">{item.value}</dd>
              {item.sub ? (
                <dd className={cn("text-xs", item.tone === "good" ? "text-success" : item.tone === "bad" ? "text-critical" : "text-muted-foreground")}>
                  {item.sub}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-strong text-xs text-muted-foreground">
              <tr>
                {block.columns.map((column) => (
                  <th key={column.label} className={cn("px-3 py-2 font-medium", column.align === "right" ? "text-right" : "text-left")}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={block.highlight?.includes(rowIndex) ? "bg-brand-tint font-medium" : undefined}>
                  {row.map((value, colIndex) => (
                    <td key={colIndex} className={cn("px-3 py-2 tabular", block.columns[colIndex]?.align === "right" ? "text-right" : "text-left")}>
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
      // A compact table keeps the values readable; the PDF draws the chart.
      return (
        <div>
          {block.title ? <p className="mb-2 text-sm font-medium text-foreground">{block.title}</p> : null}
          <ol className="flex flex-wrap gap-2 text-xs">
            {block.points.map((point) => (
              <li key={point.label} className="rounded border border-border px-2 py-1">
                <span className="text-muted-foreground">{point.label}</span>{" "}
                <span className="font-semibold tabular text-foreground">{point.value ?? "—"}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "heatmap":
      return (
        <div>
          {block.title ? <p className="mb-2 text-sm font-medium text-foreground">{block.title}</p> : null}
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
        </div>
      );
    case "list":
      return (
        <div>
          {block.title ? <p className="mb-1 text-sm font-medium text-foreground">{block.title}</p> : null}
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {block.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      );
    case "unavailable":
      return (
        <div className="rounded-md border border-dashed border-border p-3 text-sm">
          {block.title ? <p className="font-medium text-foreground">{block.title}</p> : null}
          <p className="text-muted-foreground">{block.message}</p>
        </div>
      );
    case "page_break":
      return <hr className="border-border" />;
    default:
      return null;
  }
}
