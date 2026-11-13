import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Month-on-month change of one Google search term. More searches is good news (green); fewer is just
 * information (grey, never amber or red): a dip in search volume isn't something to fix. The arrow and
 * the screen-reader word carry the direction, so colour is never the only signal. Shared by the
 * Keywords page, GBP Overview and the keyword sheet.
 */
export function TermChange({ change, className }: { change: number | null | undefined; className?: string }) {
  if (change == null) return <span className={cn("align-middle text-xs text-muted-foreground", className)}>—</span>;
  if (change === 0) return <span className={cn("align-middle text-xs font-semibold text-muted-foreground", className)}>No change</span>;
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 align-middle text-xs font-semibold tabular-nums", up ? "text-success" : "text-muted-foreground", className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {Math.abs(change).toLocaleString()}
    </span>
  );
}
