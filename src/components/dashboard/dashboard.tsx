import { Building2, CalendarRange, MapPin, RefreshCw, X } from "lucide-react";
import type { DashboardSort, GbpReport, RankTrackerResponse } from "@/api";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { ChartSkeleton, ListSkeleton, TableSkeleton } from "@/components/layout/shared/feedback/states";
import type { SortOrder } from "@/components/layout/shared/data-table";
import { AgencyKpis, BusinessKpis } from "@/components/dashboard/dashboard-kpis";
import { CompetitorsCard } from "@/components/dashboard/competitors-card";
import { BusinessLocationsCard } from "@/components/dashboard/locations-card";
import { NextStepsPanel, NextStepsSkeleton } from "@/components/dashboard/next-steps";
import { ProfilePerformanceCard } from "@/components/dashboard/performance-card";
import { PortfolioCard } from "@/components/dashboard/portfolio-table";
import { AgencyWhatChanged, BusinessWhatChanged } from "@/components/dashboard/what-changed";
import type { AgencyDashboardModel, BusinessDashboardModel } from "@/lib/dashboard/dashboard-data";
import { competitorLines, keywordMoves } from "@/lib/dashboard/focus-data";
import type { WritingMode } from "@/lib/dashboard/replies";
import { formatShortDate } from "@/lib/datetime";
import { locationPath } from "@/lib/mypageseo/section-links";

/** The one location every block describes, or null for all of them. */
export type DashboardFocus = { id: string; name: string };

type FocusData = {
  report: GbpReport | undefined;
  reportLoading: boolean;
  tracker: RankTrackerResponse | undefined;
  trackerLoading: boolean;
};

function topFixOf(report: GbpReport | undefined): string | null {
  return report?.gbp_score.available ? (report.gbp_score.top_fixes[0]?.label ?? null) : null;
}

/* ----------------------------------------------------------------------- business -- */

/**
 * Business "Today": next steps first, the four health numbers, profile performance next to what
 * changed, then competitors (one location in view) or the locations side by side (all of them).
 */
export function BusinessDashboardView({
  model,
  focus,
  focusData,
  multiLocation,
  onFocus,
  nextStepsPrimary = true,
  writing = "ai",
  performanceScope,
}: {
  model: BusinessDashboardModel;
  focus: DashboardFocus | null;
  focusData: FocusData;
  multiLocation: boolean;
  onFocus: (locationId: string) => void;
  /** False while the setup card above holds the page's primary action. */
  nextStepsPrimary?: boolean;
  /** What the person can write right now (reply and post buttons follow it). */
  writing?: WritingMode;
  /** Whose profile the performance numbers cover ("Your Google profile"…). */
  performanceScope?: string;
}) {
  const { report, reportLoading, tracker, trackerLoading } = focusData;
  return (
    <>
      <NextStepsPanel steps={model.nextSteps} showLocation={!focus && multiLocation} primary={nextStepsPrimary} writing={writing} />
      <BusinessKpis model={model} focusId={focus?.id ?? null} topFix={focus ? topFixOf(report) : null} writing={writing} />
      <div className="grid gap-6 xl:grid-cols-3">
        <ProfilePerformanceCard
          className="xl:col-span-2"
          performance={model.performance}
          days={model.rangeDays}
          report={focus ? report : null}
          reportLoading={Boolean(focus) && reportLoading}
          detailsTo={focus ? locationPath(focus.id, "gbp") : undefined}
          {...(performanceScope ? { scopeLabel: performanceScope } : {})}
        />
        <BusinessWhatChanged model={model} moves={focus ? keywordMoves(tracker) : null} focusId={focus?.id ?? null} />
      </div>
      {focus ? (
        <CompetitorsCard
          lines={competitorLines(tracker, report, focus.name)}
          loading={trackerLoading}
          noRankings={!trackerLoading && !tracker}
          locationId={focus.id}
          attribution={report?.attribution?.text ?? null}
        />
      ) : model.locations.length > 1 ? (
        <BusinessLocationsCard rows={model.locations} onFocus={onFocus} />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------------- agency -- */

/** Agency "Today": next steps across clients, portfolio numbers, what changed and the portfolio table. */
export function AgencyDashboardView({
  model,
  focus,
  focusData,
  sort,
  order,
  onSort,
  onPage,
  tableBusy,
  nextStepsPrimary = true,
  writing = "ai",
  performanceScope,
}: {
  model: AgencyDashboardModel;
  focus: DashboardFocus | null;
  focusData: FocusData;
  sort: DashboardSort;
  order: SortOrder;
  onSort: (field: DashboardSort) => void;
  onPage: (page: number) => void;
  tableBusy: boolean;
  /** False while the setup card above holds the page's primary action. */
  nextStepsPrimary?: boolean;
  /** What the person can write right now (reply and post buttons follow it). */
  writing?: WritingMode;
  /** Whose profiles the performance numbers cover ("Your clients' Google profiles combined"…). */
  performanceScope?: string;
}) {
  return (
    <>
      <NextStepsPanel steps={model.nextSteps} showLocation={!focus} primary={nextStepsPrimary} writing={writing} />
      <AgencyKpis model={model} />
      <div className="grid gap-6 xl:grid-cols-3">
        <ProfilePerformanceCard
          className="xl:col-span-2"
          performance={model.performance}
          days={model.rangeDays}
          report={focus ? focusData.report : null}
          reportLoading={Boolean(focus) && focusData.reportLoading}
          detailsTo={focus ? locationPath(focus.id, "gbp") : undefined}
          {...(performanceScope ? { scopeLabel: performanceScope } : {})}
        />
        <AgencyWhatChanged model={model} writing={writing} />
      </div>
      <PortfolioCard portfolio={model.portfolio} sort={sort} order={order} onSort={onSort} onPage={onPage} busy={tableBusy} />
    </>
  );
}

/* ------------------------------------------------------------------- scope + state -- */

/**
 * Under the title: what the numbers cover (the organization's locations, or one location with a
 * way back to all), the period, and when the data was last refreshed.
 */
export function DashboardScopeLine({
  organizationName,
  locationCount,
  focus,
  focusCity,
  days,
  refreshedAt,
  nextRefreshAt,
  onShowAll,
}: {
  organizationName: string | null;
  locationCount: number;
  focus: DashboardFocus | null;
  focusCity: string | null;
  days: number;
  refreshedAt: string | null;
  nextRefreshAt: string | null;
  /** Shown when one location was picked out of several. */
  onShowAll?: (() => void) | undefined;
}) {
  const chip = "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-xs";
  return (
    <ul className="flex flex-wrap items-center gap-2">
      <li className={chip}>
        {focus ? (
          <>
            <MapPin aria-hidden className="size-3.5 shrink-0 text-primary" />
            <span className="sr-only">Showing one location:</span>
            <span className="truncate">{focus.name}</span>
            {focusCity ? <span className="shrink-0 text-muted-foreground">· {focusCity}</span> : null}
            {onShowAll ? (
              <button
                type="button"
                onClick={onShowAll}
                aria-label="Show all locations"
                title="Show all locations"
                className="relative -mr-1 ml-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground outline-hidden after:absolute after:-inset-2 after:content-[''] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            ) : null}
          </>
        ) : (
          <>
            <Building2 aria-hidden className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{organizationName ?? "Your organization"}</span>
            <span className="shrink-0 text-muted-foreground">· {locationCount === 1 ? "1 location" : `All ${locationCount} locations`}</span>
          </>
        )}
      </li>
      <li className={chip}>
        <CalendarRange aria-hidden className="size-3.5 shrink-0 text-primary" />
        Last {days} days vs the {days} before
      </li>
      {refreshedAt ? (
        <li className={`${chip} text-muted-foreground`} title={nextRefreshAt ? `Next automatic update: ${formatShortDate(nextRefreshAt)}` : undefined}>
          <RefreshCw aria-hidden className="size-3.5 shrink-0 text-primary" />
          Updated {formatShortDate(refreshedAt)}
          <span className="sr-only">{nextRefreshAt ? `, next update ${formatShortDate(nextRefreshAt)}` : ""}</span>
        </li>
      ) : null}
    </ul>
  );
}

/**
 * While another period or location loads, the figures on screen stay at full strength (fading them
 * would drop text below readable contrast); a thin bar along the top says new numbers are coming.
 */
export function RefetchBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div role="status" aria-label="Updating the dashboard" className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-0.5 overflow-hidden">
      <div className="h-full w-full animate-pulse bg-linear-to-r from-primary via-highlight to-primary" />
    </div>
  );
}

/** Loading: the same frame as the dashboard (next steps, tiles, charts, table), so nothing jumps. */
export function DashboardSkeleton({ agency = false }: { agency?: boolean }) {
  const tiles = agency ? ["Clients", "Locations", "Top 3 rate", "Profile score", "Citation score"] : ["Average rank", "Profile score", "Reviews", "Citation score"];
  return (
    <div role="status" aria-label="Loading the dashboard" className="space-y-6">
      <NextStepsSkeleton />
      <div className={agency ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-5" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"}>
        {tiles.map((label, index) => (
          <KpiTile
            key={label}
            label={label}
            value=""
            loading
            className={agency ? (index < 3 ? "lg:col-span-2 xl:col-span-1" : index === 3 ? "lg:col-span-3 xl:col-span-1" : "sm:col-span-2 lg:col-span-3 xl:col-span-1") : undefined}
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <ChartSkeleton className="xl:col-span-2" />
        <ListSkeleton rows={4} />
      </div>
      <TableSkeleton rows={4} columns={agency ? 7 : 5} />
    </div>
  );
}
