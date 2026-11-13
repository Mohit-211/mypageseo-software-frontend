import { Link } from "react-router-dom";
import { ArrowRight, Swords, Trophy } from "lucide-react";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { EmptyState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { Th, TableBody, TableHead, TableRow, TableScroll, tdClass, tdNumberClass } from "@/components/layout/shared/data-table";
import { Button } from "@/components/ui/button";
import type { CompetitorLine } from "@/lib/dashboard/focus-data";
import { locationPath } from "@/lib/mypageseo/section-links";
import { cn } from "@/lib/utils";

/**
 * You against the competitors you track, best average rank first ("You" highlighted in place, with
 * its position), plus their public rating, reviews and photos.
 */
export function CompetitorsCard({
  lines,
  loading,
  noRankings = false,
  locationId,
  attribution,
}: {
  lines: CompetitorLine[];
  loading: boolean;
  /** No ranking check has finished yet, so there is nothing to compare (not "no competitors"). */
  noRankings?: boolean;
  locationId: string;
  attribution: string | null;
}) {
  const you = lines.find((line) => line.isYou);
  const ranked = lines.filter((line) => line.position !== null).length;

  return (
    <section aria-labelledby="competitors-title" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
        {/* The chip sits on the title line, as in the other dashboard cards, not beside the wrapped description. */}
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={Swords} tone="competitors" size="md" className="-mt-0.5" />
          <div className="min-w-0">
            <h2 id="competitors-title" className="flex flex-wrap items-center gap-2 text-[15px] font-semibold leading-6 text-foreground">
              Competitors
              {you?.position ? (
                <StatusBadge tone={you.position === 1 ? "success" : "brand"} size="sm" icon={you.position === 1 ? Trophy : undefined}>
                  You're #{you.position} of {ranked}
                </StatusBadge>
              ) : null}
            </h2>
            <p className="text-[13px] text-muted-foreground">Average Google Maps rank across your keywords. Lower is better.</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={locationPath(locationId, "competitors")}>
            Compare competitors <ArrowRight aria-hidden />
          </Link>
        </Button>
      </header>

      {loading ? (
        <ListSkeleton rows={3} className="rounded-none border-0 shadow-none" />
      ) : lines.length === 0 && noRankings ? (
        <EmptyState
          variant="unavailable"
          compact
          className="m-4 sm:m-5"
          title="Competitor ranks are on their way"
          description="They appear here after the first ranking check finishes."
        />
      ) : lines.length === 0 ? (
        <EmptyState
          icon={Swords}
          tone="competitors"
          compact
          className="m-4 sm:m-5"
          title="Compare with your competitors"
          description="Track up to 5 nearby businesses to see who ranks above you, and why."
          action={
            <Button asChild size="sm">
              <Link to={locationPath(locationId, "competitors")}>Add competitors</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Phones: one compact row per business instead of a table that scrolls sideways. */}
          <ol className="divide-y divide-border md:hidden">
            {lines.map((line) => (
              <li
                key={line.key}
                className={cn("flex items-center gap-3 px-4 py-3", line.isYou && "bg-brand-tint shadow-[inset_3px_0_0_var(--color-primary)]")}
              >
                <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">{line.position ?? "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("truncate text-sm", line.isYou ? "font-semibold" : "font-medium")}>{line.name}</span>
                    {line.isYou ? (
                      <StatusBadge tone="brand" size="sm">
                        You
                      </StatusBadge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[
                      line.rating === null ? null : `★ ${line.rating.toFixed(1)}`,
                      line.reviews === null ? null : `${line.reviews.toLocaleString()} reviews`,
                      line.photos === null ? null : `${line.photos} photos`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No public details"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">{line.rankText}</span>
                  <span className="block text-xs text-muted-foreground">avg. rank</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="hidden md:block">
            <TableScroll minWidth={560} label="You and your competitors">
              <TableHead>
                <Th className="w-14">#</Th>
                <Th>Business</Th>
                <Th align="right">Avg. rank</Th>
                <Th align="right">Rating</Th>
                <Th align="right">Reviews</Th>
                <Th align="right">Photos</Th>
              </TableHead>
              <TableBody>
                {lines.map((line) => (
                  <TableRow
                    key={line.key}
                    selected={line.isYou}
                    className={cn(line.isYou && "shadow-[inset_3px_0_0_var(--color-primary)]")}
                  >
                    <td className={cn(tdClass, "tabular-nums text-muted-foreground")}>{line.position ?? "—"}</td>
                    <td className={tdClass}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("truncate", line.isYou ? "font-semibold" : "font-medium")}>{line.name}</span>
                        {line.isYou ? (
                          <StatusBadge tone="brand" size="sm">
                            You
                          </StatusBadge>
                        ) : null}
                      </span>
                    </td>
                    <td className={cn(tdNumberClass, "font-semibold")}>{line.rankText}</td>
                    <td className={tdNumberClass}>{line.rating === null ? "—" : line.rating.toFixed(1)}</td>
                    <td className={tdNumberClass}>{line.reviews === null ? "—" : line.reviews.toLocaleString()}</td>
                    <td className={tdNumberClass}>{line.photos ?? "—"}</td>
                  </TableRow>
                ))}
              </TableBody>
            </TableScroll>
          </div>
          {attribution ? <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">Business names, ratings and reviews: {attribution}</p> : null}
        </>
      )}
    </section>
  );
}
