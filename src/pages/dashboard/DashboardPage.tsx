import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { LayoutDashboard, Link2, MapPinPlus, MapPinOff, Moon, Sun, Sunrise } from "lucide-react";
import { getDashboard, getProfile, isApiError, isOnboardingPending, type DashboardSort } from "@/api";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { SectionErrorBoundary } from "@/components/layout/shared/feedback/failure-states";
import type { SortOrder } from "@/components/layout/shared/data-table";
import {
  AgencyDashboardView,
  BusinessDashboardView,
  DashboardScopeLine,
  DashboardSkeleton,
  RefetchBar,
  type DashboardFocus,
} from "@/components/dashboard/dashboard";
import { GettingStartedCard } from "@/components/dashboard/getting-started-card";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { useAiStatus } from "@/lib/ai/ai-status";
import { DEFAULT_RANGE, RANGE_DAYS, RANGE_OPTIONS, isDashboardRange, toAgencyDashboard, toBusinessDashboard } from "@/lib/dashboard/dashboard-data";
import { reportRangeFor } from "@/lib/dashboard/focus-data";
import { writingModeFor } from "@/lib/dashboard/replies";
import { gbpReportQuery } from "@/lib/gbp/use-gbp-report";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { gettingStartedStep, onboardingStateQuery } from "@/lib/locations/onboarding-state";
import { useLocationsList } from "@/lib/locations/use-locations";
import { rankTrackerQuery } from "@/lib/rankings/use-rankings";
import { byText, sortRows } from "@/lib/sort";
import { useWorkspace, type LocationSummary } from "@/lib/mypageseo/workspace";

const searchSchema = z.object({
  range: z.string().optional(),
  location: z.string().optional(),
  // Portfolio table (agency): named so they never clash with `range` / `location`.
  psort: z.string().optional(),
  porder: z.string().optional(),
  ppage: z.coerce.number().optional(),
});

const ALL = "all";
const PORTFOLIO_PAGE_SIZE = 25;
const PORTFOLIO_SORTS: DashboardSort[] = ["name", "client", "rank", "rank_change", "gbp_score"];
/** First click on a column: names A–Z, ranks best (lowest) first, scores and gains highest first. */
const FIRST_ORDER: Record<DashboardSort, SortOrder> = { name: "asc", client: "asc", rank: "asc", rank_change: "desc", gbp_score: "desc" };

/** 4xx answers (an unknown `?location=`) are states, not failures to retry. */
const retry = (count: number, error: unknown) => !(isApiError(error) && error.status < 500) && count < 2;

function greetingFor(hour: number): { text: string; icon: typeof Sun } {
  if (hour >= 5 && hour < 12) return { text: "Good morning", icon: Sunrise };
  if (hour >= 12 && hour < 18) return { text: "Good afternoon", icon: Sun };
  return { text: "Good evening", icon: Moon };
}

/**
 * The dashboard, "Today": what to do next, how the business is doing and what changed, for every
 * location or one (`?location=`), over the last 15, 30 or 60 days (`?range=`). Every block follows
 * the same scope. With one location in view it also reads that location's GBP report (daily views,
 * competitors' public data) and Rank Tracker (competitor ranks, keyword moves).
 */
function DashboardPage() {
  const { organization, locations, clients, status: workspaceStatus, activeLocation, setActiveLocationId } = useWorkspace();
  const isAgency = organization?.accountType === "agency";
  const access = useAccess();
  const canEdit = useCanEdit();
  const { connect } = useGbpConnect();
  const [search, setSearch] = useTypedSearch(searchSchema);

  const range = isDashboardRange(search.range) ? search.range : DEFAULT_RANGE;
  const days = RANGE_DAYS[range];
  const locationId = search.location?.trim() || undefined;
  const sort = PORTFOLIO_SORTS.includes(search.psort as DashboardSort) ? (search.psort as DashboardSort) : "name";
  const order: SortOrder = search.porder === "asc" || search.porder === "desc" ? search.porder : FIRST_ORDER[sort];
  const page = Math.max(1, Math.floor(search.ppage ?? 1));

  const update = (patch: Partial<z.infer<typeof searchSchema>>) => setSearch((previous) => ({ ...previous, ...patch }), { replace: true });

  const dashboard = useQuery({
    queryKey: ["dashboard", organization?.id ?? "none", locationId ?? ALL, range, ...(isAgency ? [sort, order, page] : [])],
    queryFn: ({ signal }) =>
      getDashboard(
        {
          range,
          ...(locationId ? { location_id: locationId } : {}),
          ...(isAgency ? { sort, order, page, limit: PORTFOLIO_PAGE_SIZE } : {}),
        },
        signal,
      ),
    enabled: Boolean(organization),
    // The figures stay on screen while another period or table page loads. Picking another
    // location (or all of them, or another organization) shows the skeleton instead: every block
    // follows the picked scope, so the last scope's numbers must never sit under the new name.
    placeholderData: (previous, previousQuery) =>
      previous && previousQuery?.queryKey[1] === (organization?.id ?? "none") && previousQuery.queryKey[2] === (locationId ?? ALL) ? previous : undefined,
    // Figures change when ranking checks, syncs and reports finish in the background.
    refetchInterval: 60_000,
    retry,
  });
  const live = dashboard.data;

  // One location in view: the one picked, or the only one there is.
  const picked = locationId ? (locations.find((location) => location.id === locationId) ?? null) : null;
  const focusSummary: LocationSummary | null = picked ?? (!locationId && locations.length === 1 ? locations[0]! : null);
  const focus: DashboardFocus | null = focusSummary
    ? { id: focusSummary.id, name: focusSummary.businessName }
    : locationId && live?.selected_location?.location_id === locationId
      ? { id: locationId, name: live.selected_location.name }
      : null;
  const focusCity = focusSummary?.city || focusSummary?.area || (live?.selected_location?.city ?? null);

  // Reply and post buttons follow what this person can write now. The AI switch and the daily
  // budget are server-wide, so any location of the organization answers for all of them (never
  // ask without one: that answers "unknown").
  const ai = useAiStatus(focus?.id ?? activeLocation?.id ?? locations[0]?.id ?? null);
  const writing = writingModeFor(ai);

  // Whose numbers "Profile performance" adds up.
  const performanceScope =
    !isAgency && locations.length === 1
      ? "Your Google profile"
      : focus
        ? `${focus.name}'s Google profile`
        : isAgency && access.can("clients.view")
          ? "Your clients' Google profiles combined"
          : "All your Google profiles combined";

  // A location picked here is the sidebar's location too, so its location links follow.
  const pickLocation = (id: string) => {
    setActiveLocationId(id);
    update({ location: id, ppage: undefined });
  };

  // The location's own data for the detail panels (skipped when its Google profile isn't connected).
  const gbpReady = !live || live.performance.available || live.performance.reason !== "gbp_not_connected";
  const report = useQuery({
    ...gbpReportQuery(focus?.id ?? "", reportRangeFor(days)),
    enabled: Boolean(focus) && gbpReady,
    // Keep the chart while a longer window loads, but never show another location's.
    placeholderData: (previous) => (previous && previous.location_id === focus?.id ? previous : undefined),
  });
  const tracker = useQuery({ ...rankTrackerQuery(focus?.id ?? ""), enabled: Boolean(focus) && !isAgency });

  // The setup card: only for organizations that signed in with setup still open.
  const [setupPending] = useState(isOnboardingPending);
  const onboarding = useQuery({ ...onboardingStateQuery(), enabled: setupPending && Boolean(organization) && canEdit });
  // While the setup card shows, its button is the page's primary action (same rule as the card).
  const setupCardShown = canEdit && Boolean(gettingStartedStep(onboarding.data, { canEditBrand: access.can("white_label.manage") }));

  const profile = useQuery({ queryKey: ["profile"], queryFn: ({ signal }) => getProfile(signal), staleTime: 5 * 60_000 });
  const now = useNow(10 * 60_000);
  const greeting = greetingFor(new Date(now).getHours());
  const firstName = profile.data?.name?.trim().split(/\s+/)[0] ?? "";
  const GreetingIcon = greeting.icon;

  const notFound = isApiError(dashboard.error) && (dashboard.error.status === 404 || dashboard.error.reason === "location_not_found");
  const noLocations = workspaceStatus === "ready" && locations.length === 0;
  // No location yet, but profiles picked from Google may be waiting: lead straight to them (the add
  // page lists them first). `pending_gbp` comes with any page of the list; one row is enough.
  const picks = useLocationsList({ page: 1, limit: 1 }, { enabled: noLocations && canEdit }).data?.pending_gbp ?? [];

  const header = (
    <PageHeader
      icon={LayoutDashboard}
      tone="dashboard"
      title="Dashboard"
      eyebrow={
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <GreetingIcon aria-hidden className="size-3.5 text-primary" />
          {greeting.text}
          {firstName ? `, ${firstName}` : ""}
        </span>
      }
      description="What changed, and what to do next."
      meta={
        noLocations ? undefined : (
          <DashboardScopeLine
            organizationName={organization?.name ?? null}
            locationCount={locations.length || (live?.locations_count ?? 0)}
            focus={focus}
            focusCity={focusCity}
            days={days}
            refreshedAt={live?.type === "business" ? (live.refresh?.last_refreshed_at ?? null) : null}
            nextRefreshAt={live?.type === "business" ? (live.refresh?.next_refresh_at ?? null) : null}
            onShowAll={locationId ? () => update({ location: undefined, ppage: undefined }) : undefined}
          />
        )
      }
      actions={
        noLocations ? undefined : (
          <>
            {locations.length > 1 ? (
              <LocationPicker
                value={locationId ?? ALL}
                locations={locations}
                clients={isAgency ? clients : []}
                onChange={(value) => (value === ALL ? update({ location: undefined, ppage: undefined }) : pickLocation(value))}
              />
            ) : null}
            <SegmentedControl
              aria-label="Period"
              size="sm"
              value={range}
              options={RANGE_OPTIONS}
              onValueChange={(value) => update({ range: value === DEFAULT_RANGE ? undefined : value })}
            />
          </>
        )
      }
    />
  );

  const body =
    noLocations && canEdit && picks.length > 0 ? (
      <EmptyState
        icon={MapPinPlus}
        tone="locations"
        title={picks.length === 1 ? "Add the profile you picked" : `Add the ${picks.length} profiles you picked`}
        description={`${picks.length === 1 ? `${picks[0]!.title} is` : "They're"} ready to add. Choose the keywords to track next, and the first ranking check starts.`}
        action={
          <Button asChild>
            <Link to="/locations/add">
              <MapPinPlus aria-hidden /> {picks.length === 1 ? "Add it now" : "Add them now"}
            </Link>
          </Button>
        }
      />
    ) : noLocations ? (
      <EmptyState
        icon={MapPinPlus}
        tone="locations"
        title="Add your first location"
        description="MyPageSEO builds this page from your locations: where you rank on Google Maps, how your Google profile performs, your reviews and your listings."
        {...(canEdit
          ? {
              action: (
                <Button asChild>
                  <Link to="/locations/add">
                    <MapPinPlus aria-hidden /> Add location
                  </Link>
                </Button>
              ),
              secondaryAction: (
                <Button variant="outline" onClick={() => connect()}>
                  <Link2 aria-hidden /> Connect Google
                </Button>
              ),
            }
          : {})}
      />
    ) : notFound ? (
    <EmptyState
      icon={MapPinOff}
      tone="locations"
      title="That location isn't in this workspace"
      description="It may have been removed, or it belongs to another organization."
      action={<Button onClick={() => update({ location: undefined, ppage: undefined })}>Show all locations</Button>}
    />
  ) : workspaceStatus === "loading" || dashboard.isPending ? (
    <DashboardSkeleton agency={isAgency} />
  ) : !live ? (
    <ErrorState description="The dashboard couldn't be loaded. Your data is safe; try again in a moment." onRetry={() => void dashboard.refetch()} />
  ) : (
    <SectionErrorBoundary title="The dashboard couldn't be shown">
      {/* The figures keep full strength while new ones load; the bar at the top says so. */}
      <div className="space-y-6" aria-busy={dashboard.isPlaceholderData || undefined}>
        {onboarding.data ? <GettingStartedCard state={onboarding.data} /> : null}
        {live.type === "agency" ? (
          <AgencyDashboardView
            model={toAgencyDashboard(live)}
            focus={focus}
            focusData={{ report: report.data, reportLoading: report.isPending && report.fetchStatus !== "idle", tracker: undefined, trackerLoading: false }}
            sort={sort}
            order={order}
            onSort={(next) => {
              const nextOrder = next === sort ? (order === "asc" ? "desc" : "asc") : FIRST_ORDER[next];
              const isDefault = next === "name" && nextOrder === FIRST_ORDER.name;
              update({ psort: isDefault ? undefined : next, porder: isDefault ? undefined : nextOrder, ppage: undefined });
            }}
            onPage={(next) => update({ ppage: next > 1 ? next : undefined })}
            tableBusy={dashboard.isPlaceholderData}
            nextStepsPrimary={!setupCardShown}
            writing={writing}
            performanceScope={performanceScope}
          />
        ) : (
          <BusinessDashboardView
            model={toBusinessDashboard(live)}
            focus={focus}
            focusData={{
              report: report.data,
              reportLoading: report.isPending && report.fetchStatus !== "idle",
              tracker: tracker.data,
              trackerLoading: tracker.isPending && tracker.fetchStatus !== "idle",
            }}
            multiLocation={locations.length > 1}
            onFocus={pickLocation}
            nextStepsPrimary={!setupCardShown}
            writing={writing}
            performanceScope={performanceScope}
          />
        )}
      </div>
    </SectionErrorBoundary>
  );

  return (
    <>
      <RefetchBar active={dashboard.isFetching && dashboard.isPlaceholderData} />
      {header}
      {body}
    </>
  );
}

/** "All locations" or one of them; agencies see them grouped by client (A–Z, "No client" last). */
function LocationPicker({
  value,
  locations,
  clients,
  onChange,
}: {
  value: string;
  locations: LocationSummary[];
  clients: { id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  const sorted = sortRows(locations, byText((location) => location.businessName));
  const groups =
    clients.length > 0
      ? [
          ...sortRows(clients, byText((client) => client.name)).map((client) => ({
            key: client.id,
            label: client.name as string | null,
            items: sorted.filter((location) => location.clientId === client.id),
          })),
          { key: "none", label: "No client", items: sorted.filter((location) => !location.clientId || !clients.some((client) => client.id === location.clientId)) },
        ].filter((group) => group.items.length > 0)
      : [{ key: "all", label: null, items: sorted }];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full min-w-0 sm:w-80" aria-label="Location">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value={ALL}>All locations</SelectItem>
        {groups.map((group) => (
          <SelectGroup key={group.key}>
            <SelectSeparator />
            {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
            {group.items.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.businessName}
                {location.city ? ` · ${location.city}` : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export default DashboardPage;
