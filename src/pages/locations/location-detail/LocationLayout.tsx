import { useMemo } from "react";
import { Link, Outlet } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LayoutDashboard, MapPinOff, ShieldOff } from "lucide-react";
import { isApiError } from "@/api";
import { ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { MODULE_TONE_CLASSES } from "@/components/layout/shared/module-tone";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useRequiredParams } from "@/hooks/use-required-params";
import { LocationRouteContext, type LocationRouteValue } from "@/lib/locations/location-route-context";
import { locationOverviewQuery, locationQuery } from "@/lib/locations/use-locations";
import { cn } from "@/lib/utils";

/**
 * Frame of every page of one location (`/locations/:locationId/…`): overview, keywords, rankings,
 * GBP, reputation, citations and AI. It loads the location once (`GET locations/:id`) and owns its
 * loading, not-found and error states (drawn inside the shell, under the sidebar and header), so
 * each page can rely on it (`useLocationRoute()`). Moving between those pages keeps this mounted:
 * no second request and no skeleton.
 */
function LocationLayout() {
  const { locationId } = useRequiredParams("locationId");
  const queryClient = useQueryClient();
  const location = useQuery({
    // A 404 / 403 isn't retried (see `locationQuery`): the page says so at once.
    ...locationQuery(locationId),
    // The overview answer is the same header plus summaries, so a location whose overview is
    // already loaded opens at once.
    initialData: () => queryClient.getQueryData(locationOverviewQuery(locationId).queryKey),
    initialDataUpdatedAt: () => queryClient.getQueryState(locationOverviewQuery(locationId).queryKey)?.dataUpdatedAt,
  });
  const data = location.data;
  const value = useMemo<LocationRouteValue | null>(() => (data ? { location: data } : null), [data]);

  // Data first: a failed background refresh keeps the page that is already on screen.
  if (value) {
    return (
      <LocationRouteContext.Provider value={value}>
        {/* Keyed by location: switching to another location opens its page fresh (its own data or
            a skeleton, never the last location's numbers, drafts, search or open dialogs), while
            moving between one location's pages keeps this layout as it is. */}
        <Outlet key={locationId} context={value} />
      </LocationRouteContext.Provider>
    );
  }

  if (location.isError) {
    const status = isApiError(location.error) ? location.error.status : 0;
    if (status === 404 || status === 403) return <LocationUnavailable forbidden={status === 403} />;
    return (
      <ErrorState
        title="This location couldn't be loaded"
        description="Check your connection and try again. Nothing was changed."
        onRetry={() => void location.refetch()}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/locations">All locations</Link>
          </Button>
        }
      />
    );
  }

  // The page's own header area stays in place while the location loads.
  return <PageSkeleton metrics={4} rows={4} />;
}

/**
 * The location in the address doesn't exist (404) or isn't open to this user (403). A page of its
 * own: it names the tab and the history entry, the shell announces it after an in-app move, and
 * its heading is where the shell and closing dialogs put focus (`data-page-header`).
 */
function LocationUnavailable({ forbidden }: { forbidden: boolean }) {
  const title = forbidden ? "No access to this location" : "Location not found";
  useDocumentTitle([title]);
  const Icon = forbidden ? ShieldOff : MapPinOff;
  return (
    <div
      data-page-header
      className="mx-auto flex w-full max-w-xl flex-col items-center rounded-xl border border-border bg-card px-6 py-10 text-center shadow-card sm:px-10"
    >
      <span aria-hidden className="rounded-full bg-muted/70 p-1.5">
        <span className={cn("grid size-12 place-items-center rounded-full", MODULE_TONE_CLASSES.locations.chip)}>
          <Icon className="size-6" />
        </span>
      </span>
      <h1 tabIndex={-1} className="mt-4 text-xl font-semibold tracking-tight text-foreground outline-none">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {forbidden
          ? "It belongs to a client you don't work on. Ask the account owner if you need it."
          : "It may have been deleted, or it isn't in this organization. Pick another one from your locations."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/locations">
            <ArrowLeft aria-hidden /> All locations
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/dashboard">
            <LayoutDashboard aria-hidden /> Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default LocationLayout;
