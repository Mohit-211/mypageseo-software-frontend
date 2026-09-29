import { ExternalLink, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { TableBody, TableHead, TableRow, TableScroll, Th, tdClass, tdMutedClass } from "@/components/layout/shared/data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatSigned } from "@/lib/ai-visibility/ai-visibility";
import { ChangeIndicator } from "../visibility-ui";

export type ComparisonRow = {
  id: string;
  name: string;
  website: string | null;
  isOwn: boolean;
  selected: boolean;
  visibility: number;
  mentions: number;
  /** Relative % change vs previous period. */
  change: number | null;
  /** Percentage-point difference from your business; null on your own row. */
  difference: number | null;
};

export function CompetitorTable({
  rows,
  onToggle,
  onRemove,
}: {
  rows: ComparisonRow[];
  onToggle: (id: string, selected: boolean) => void;
  onRemove: (row: ComparisonRow) => void;
}) {
  return (
    <TableScroll minWidth={640} label="AI visibility comparison">
      <TableHead>
        <Th className="w-10">
          <span className="sr-only">Compare</span>
        </Th>
        <Th>Business</Th>
        <Th align="right">Visibility</Th>
        <Th align="right">Mentions</Th>
        <Th align="right">Difference</Th>
        <Th align="right">Change</Th>
        <Th srOnly align="right">
          Actions
        </Th>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className={row.isOwn ? "bg-brand-tint/60" : !row.selected ? "opacity-60" : undefined}>
            <td className={tdClass}>
              {row.isOwn ? null : (
                <Checkbox
                  checked={row.selected}
                  onCheckedChange={(c) => onToggle(row.id, c === true)}
                  aria-label={`Include ${row.name} in comparison`}
                />
              )}
            </td>
            <td className={tdClass}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{row.name}</span>
                {row.isOwn ? <StatusBadge tone="brand">Your business</StatusBadge> : null}
              </div>
              {row.website ? (
                <a
                  href={`https://${row.website}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {row.website} <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
            </td>
            <td className={`${tdClass} text-right tabular`}>{row.visibility}%</td>
            <td className={`${tdClass} text-right tabular`}>{row.mentions.toLocaleString()}</td>
            <td className={`${tdMutedClass} text-right tabular`}>{row.difference === null ? "—" : formatSigned(row.difference, " pts")}</td>
            <td className={`${tdClass} text-right`}>
              <ChangeIndicator value={row.change} />
            </td>
            <td className={`${tdClass} text-right`}>
              {row.isOwn ? null : (
                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-critical" aria-label={`Remove ${row.name}`} onClick={() => onRemove(row)}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </td>
          </TableRow>
        ))}
      </TableBody>
    </TableScroll>
  );
}
