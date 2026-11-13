import { BUCKET_LABEL, BUCKET_MARKER_CLASS, MAP_LEGEND_BUCKETS } from "@/lib/rankings/format";
import { cn } from "@/lib/utils";
import { PIN_KIND_CLASS, PIN_KIND_LABEL } from "./map-types";

/**
 * The map's key, as a strip under the map (both map libraries). Under, not over: a floating card
 * would hide the bottom row of grid points.
 */
function LegendCard({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      role="note"
      aria-label={label}
      className={cn("flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-card px-3 py-2 text-xs text-foreground", className)}
    >
      {children}
    </div>
  );
}

/** What the grid markers' colours mean (the rank buckets). */
export function GridLegend() {
  return (
    <LegendCard label="Rank colours">
      {MAP_LEGEND_BUCKETS.map((entry) => (
        <span key={entry.bucket} className="flex items-center gap-1.5" title={BUCKET_LABEL[entry.bucket]}>
          <span aria-hidden className={cn("size-3.5 shrink-0 rounded-full border-2 shadow-xs", BUCKET_MARKER_CLASS[entry.bucket])} />
          {entry.label}
        </span>
      ))}
    </LegendCard>
  );
}

/** What the pins mean: you, tracked competitors, other businesses and the search point. */
export function PinsLegend({ searchPoint }: { searchPoint: boolean }) {
  return (
    <LegendCard label="Map key">
      {(["self", "competitor", "other"] as const).map((kind) => (
        <span key={kind} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-3.5 shrink-0 rounded-full border-2 shadow-xs", PIN_KIND_CLASS[kind])} />
          {PIN_KIND_LABEL[kind]}
        </span>
      ))}
      {searchPoint ? (
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="grid size-3 shrink-0 place-items-center rounded-full bg-foreground/15">
            <span className="size-1.5 rounded-full bg-foreground" />
          </span>
          Search point
        </span>
      ) : null}
    </LegendCard>
  );
}
