import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getDashboard, isApiError, type DashboardRange, type BusinessDashboard as LiveBusiness } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { ComparisonControl, PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { SectionErrorBoundary } from "@/components/layout/shared/feedback/failure-states";
import { AgencyDashboardView, BusinessDashboardView, DashboardSkeleton } from "@/components/dashboard/dashboard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toAgencyDashboard, toBusinessDashboard } from "@/lib/dashboard/dashboard-data";
import { useGbpReport } from "@/lib/gbp/use-gbp-report";
import { useRankTracker } from "@/lib/rankings/use-rankings";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: "15d", label: "15 days" },
  { value: "30d", label: "30 days" },
  { value: "60d", label: "60 days" },
];
const ALL = "all";

/**
 * The dashboard. Live figures from `GET /dashboard` for the chosen location
 * (`?location=`, default all) and period (`?range=`, default 30d); for a
 * business, the detail panels (GBP health factors, competitors, review
 * response time) also read the focus location's GBP report and Rank Tracker.
 */
function DashboardPage() {
  const { organization, activeLocation, locations, status: workspaceStatus } = useWorkspace();
  const isAgency = organization?.accountType === "agency";
  const [params, setParams] = useSearchParams();
  const range = RANGES.find((option) => option.value === params.get("range"))?.value ?? "30d";
  const locationId = params.get("location") ?? undefined;

  const setParam = (key: "range" | "location", value: string | undefined) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === undefined) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const dashboard = useQuery({
    queryKey: ["dashboard", organization?.id ?? "none", locationId ?? ALL, range],
    queryFn: ({ signal }) => getDashboard({ limit: 100, range, ...(locationId ? { location_id: locationId } : {}) }, signal),
    enabled: Boolean(organization),
    // Keep the current figures on screen while another period or location loads.
    placeholderData: keepPreviousData,
    // Figures change when runs, syncs and reports finish in the background.
    refetchInterval: 60_000,
  });

  const live = dashboard.data;
  const selected = live?.selected_location ?? null;
  const focus = (locationId ? locations.find((location) => location.id === locationId) : null) ?? activeLocation ?? locations[0] ?? null;
  const notFound = isApiError(dashboard.error) && dashboard.error.reason === "location_not_found";

  const contextLabel = selected
    ? [selected.name, selected.city].filter(Boolean).join(" · ")
    : isAgency
      ? `${organization?.name ?? "Portfolio"} · all locations`
      : locations.length > 1
        ? `${organization?.name ?? "Workspace"} · all locations`
        : [focus?.businessName ?? organization?.name ?? "Workspace", focus?.area].filter(Boolean).join(" · ");

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description={
          isAgency
            ? "See portfolio performance, what changed, and where your team should act next."
            : "See how local search is performing, what changed, and what to act on next."
        }
        meta={<p className="text-xs text-muted-foreground">{contextLabel}</p>}
        actions={
          locations.length > 0 ? (
            <>
              {locations.length > 1 ? (
                <Select value={locationId ?? ALL} onValueChange={(value) => setParam("location", value === ALL ? undefined : value)}>
                  <SelectTrigger className="h-9 w-[220px] text-xs" aria-label="Location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.businessName}
                        {location.area ? ` · ${location.area}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <ComparisonControl
                value={range}
                options={RANGES}
                onChange={(value) => setParam("range", value === "30d" ? undefined : value)}
                ariaLabel="Period"
              />
            </>
          ) : null
        }
      />

      {workspaceStatus === "ready" && locations.length === 0 ? (
        <EmptyState
          title="Connect a location to start"
          description="Mypageseo builds this dashboard from your Google Business Profile locations. Add or connect a location to see visibility, ranking movement, profile health, reviews and citation issues."
          action={<Button asChild size="sm"><Link to="/locations/add">Add a location</Link></Button>}
        />
      ) : notFound ? (
        <EmptyState
          title="That location isn't in this workspace"
          description="It may have been removed, or it belongs to another organization."
          action={<Button size="sm" onClick={() => setParam("location", undefined)}>Show all locations</Button>}
        />
      ) : workspaceStatus === "loading" || dashboard.isPending ? (
        <DashboardSkeleton agency={isAgency} />
      ) : dashboard.isError || !live ? (
        <ErrorState description="The dashboard couldn't be loaded." onRetry={() => void dashboard.refetch()} />
      ) : (
        <SectionErrorBoundary title="The dashboard couldn't be shown">
          <div className={dashboard.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={dashboard.isPlaceholderData}>
            {live.type === "agency" ? (
              <AgencyDashboardView data={toAgencyDashboard(live)} />
            ) : focus ? (
              <BusinessWithFocus live={live} focusId={focus.id} focusName={focus.businessName} />
            ) : (
              <BusinessDashboardView data={toBusinessDashboard(live, { locationId: null, name: null })} />
            )}
          </div>
        </SectionErrorBoundary>
      )}
    </AppShell>
  );
}

/** Business: adds the focus location's GBP report (factors, competitors, response time) and Rank Tracker. */
function BusinessWithFocus({ live, focusId, focusName }: { live: LiveBusiness; focusId: string; focusName: string }) {
  const report = useGbpReport(focusId, "28d");
  const tracker = useRankTracker(focusId, undefined);
  const data = toBusinessDashboard(live, { locationId: focusId, name: focusName, report: report.data, tracker: tracker.data });
  return <BusinessDashboardView data={data} />;
}

export default DashboardPage;
