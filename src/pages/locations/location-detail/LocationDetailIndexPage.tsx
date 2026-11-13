import { Gauge } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/layout/shared/data-display";
import { SectionError } from "@/components/layout/shared/feedback/states";
import { BackgroundActivity } from "@/components/location/background-activity";
import { ClientLinkCard } from "@/components/location/client-link-card";
import { LocationHero } from "@/components/location/location-hero";
import { LocationModuleTiles } from "@/components/location/location-modules";
import { LocationStatusBanner } from "@/components/location/location-status-banner";
import { ReportMenuButton } from "@/components/report/rank-report-button";
import { FirstRunProgress } from "@/components/ranking/first-run-progress";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { isBlockingStatus } from "@/lib/locations/location-status";
import { useLocationOverview } from "@/lib/locations/use-locations";
import { REPORT_CREATE_ERRORS } from "@/lib/reports/report-meta";
import { useWhiteLabelAudience } from "@/pages/white-label/white-label-audience";

/**
 * A location's overview: the hub of everything for it (there is no tab bar). Who the location is
 * (hero), what blocks it (status banner), what's running, its client link (agencies), then one
 * tile per section with its key number, each opening that section.
 *
 * The header comes from the location layout at once; the summaries (`GET locations/:id/overview`,
 * started by the route loader) fill the tiles in.
 */
function LocationOverviewPage() {
  const { location } = useLocationRoute();
  const overview = useLocationOverview(location.location_id);
  const { whiteLabel } = useWhiteLabelAudience();
  const data = overview.data;
  // The newest of the two: the overview carries the same header fields plus the summaries.
  const header = data ?? location;
  const firstRun = data && !data.rankings.available && data.rankings.reason === "no_ranking_data";

  return (
    <>
      <PageHeader
        icon={Gauge}
        tone="locations"
        title="Overview"
        // The hero right below names the location, so the eyebrow would only repeat it.
        showLocation={false}
        description="Everything about this location at a glance. Open a section to see more and act on it."
        actions={
          <ReportMenuButton
            // One filled button per page: while the status banner offers its fix, that's the primary action.
            variant={isBlockingStatus(header.status) ? "outline" : "default"}
            locationId={location.location_id}
            unavailable={
              data?.citations?.available === false && data.citations.reason === "no_citations_yet"
                ? { citation: REPORT_CREATE_ERRORS.no_citations_yet! }
                : undefined
            }
          />
        }
      />

      <LocationStatusBanner location={header} />

      {/* Before the first finished check: how long until the first data; otherwise what's running. */}
      {firstRun ? (
        <FirstRunProgress locationId={location.location_id} fallback={<BackgroundActivity locationId={location.location_id} />} />
      ) : (
        <BackgroundActivity locationId={location.location_id} />
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <LocationHero location={header} overview={data} className={whiteLabel ? "xl:col-span-2" : "xl:col-span-3"} />
        {whiteLabel ? <ClientLinkCard locationId={location.location_id} /> : null}
      </div>

      <section aria-label="Sections">
        <SectionHeader title="Sections" description="Each one opens the full page, with everything you can do there." />
        {overview.isError && !data ? (
          <SectionError
            title="The summaries couldn't be loaded"
            description="The sections still open from the sidebar. Try loading the summaries again."
            onRetry={() => void overview.refetch()}
          />
        ) : (
          <LocationModuleTiles location={header} overview={data} loading={overview.isPending} />
        )}
        {data?.attribution ? <p className="mt-3 text-xs text-muted-foreground">Ratings, reviews and competitor names: {data.attribution.text}</p> : null}
      </section>
    </>
  );
}

export default LocationOverviewPage;
