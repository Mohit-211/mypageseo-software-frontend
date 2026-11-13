import { Link } from "react-router-dom";
import { ChevronRight, MapPin, ScanSearch } from "lucide-react";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { LocationAvatar, LocationStatusBadge, RankFigure, ScoreChip } from "@/components/location/location-badges";
import { Button } from "@/components/ui/button";
import type { BusinessLocationRow } from "@/lib/dashboard/dashboard-data";
import { locationPath } from "@/lib/mypageseo/section-links";

/**
 * Every location of a business, side by side (the all-locations view). A row opens the location;
 * "Focus" narrows the dashboard to it, which also brings in its competitors and daily views.
 */
export function BusinessLocationsCard({ rows, onFocus }: { rows: BusinessLocationRow[]; onFocus: (locationId: string) => void }) {
  return (
    <section aria-labelledby="your-locations-title" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {/* The chip sits on the title line, as in the other dashboard cards, not beside the wrapped description. */}
      <header className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <IconChip icon={MapPin} tone="locations" size="md" className="-mt-0.5" />
        <div className="min-w-0">
          <h2 id="your-locations-title" className="text-[15px] font-semibold leading-6 text-foreground">
            Your locations
          </h2>
          <p className="text-[13px] text-muted-foreground">Focus on one to see its competitors, keyword moves and daily profile views.</p>
        </div>
      </header>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.locationId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <Link
              to={locationPath(row.locationId)}
              className="group -mx-2 flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2 rounded-lg px-2 py-1 outline-hidden transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
                <LocationAvatar name={row.name} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{row.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {row.city ?? "No city"}
                    {row.status !== "active" ? <LocationStatusBadge status={row.status} size="sm" /> : null}
                  </span>
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="min-w-24">
                  <span className="block text-xs text-muted-foreground">Avg. rank</span>
                  {row.rank ? <RankFigure text={row.rank.text} change={row.rank.change} /> : <span className="text-sm text-muted-foreground">—</span>}
                </span>
                <span className="min-w-20">
                  <span className="block text-xs text-muted-foreground">Profile</span>
                  <ScoreChip score={row.profileScore} label="Profile score" />
                </span>
                <span className="min-w-20">
                  <span className="block text-xs text-muted-foreground">Citations</span>
                  <ScoreChip score={row.citationScore} label="Citation score" />
                </span>
                <ChevronRight aria-hidden className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block motion-reduce:transition-none" />
              </span>
            </Link>
            <Button variant="outline" size="sm" className="self-start sm:self-center" onClick={() => onFocus(row.locationId)} aria-label={`Focus the dashboard on ${row.name}`}>
              <ScanSearch aria-hidden /> Focus
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
