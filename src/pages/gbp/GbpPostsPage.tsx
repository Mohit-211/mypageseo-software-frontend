import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  MapPin,
  Moon,
  PlugZap,
  Plus,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { getOrganizationPostsCalendar, type CalendarItem, type PostsSummary } from "@/api";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { PostsCalendar } from "@/components/posts/posts-calendar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanEdit } from "@/hooks/use-access";
import { locationPath, pickNavLocationId } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useMonth } from "@/lib/posts/calendar";
import { formatPostMoment } from "@/lib/posts/post-format";
import { POST_GROUP_OF } from "@/lib/posts/post-order";
import { postErrorText, postsSummaryQuery } from "@/lib/posts/use-posts";
import { byText, byTime, sortRows } from "@/lib/sort";

const MONTH_NAME = new Intl.DateTimeFormat(undefined, { month: "long" });

type LocationMonth = { published: number; upcoming: number; next?: string; last?: string };

/**
 * This month's posts per location: counts, the last published and the next one due. A post that
 * didn't publish doesn't make a month active (the summary reports it, see `attentionOf`).
 */
function byLocation(items: readonly CalendarItem[]): Map<string, LocationMonth> {
  const map = new Map<string, LocationMonth>();
  for (const item of sortRows(items, byTime((entry) => entry.date, "asc"))) {
    const group = POST_GROUP_OF[item.status];
    if (group === "problems") continue;
    const entry = map.get(item.location_id) ?? { published: 0, upcoming: 0 };
    if (group === "published") {
      entry.published += 1;
      entry.last = item.date;
    } else {
      if (group === "scheduled") entry.upcoming += 1;
      entry.next ??= item.date;
    }
    map.set(item.location_id, entry);
  }
  return map;
}

/**
 * What needs someone at a location, whenever it happened: posts that didn't publish (failed or
 * rejected) and posts waiting for approval. The same numbers as that location's Posts page, from
 * `GET posts/summary`. A month of the calendar can't tell: it dates a post by when it went out or
 * was due, so a failure from last month would be missed.
 */
type Attention = { problems: number; waiting: number };

function attentionOf(summary: PostsSummary | undefined): Attention | null {
  return summary ? { problems: summary.stats.failed + summary.stats.rejected, waiting: summary.stats.pending_approval } : null;
}

/** The location Posts page filter that shows what needs fixing first. */
function attentionTab(attention: Attention | null): string {
  return attention?.problems ? "?tab=problems" : attention?.waiting ? "?tab=waiting" : "";
}

/**
 * The API has no organization-wide posts summary yet, so each location in view costs one request.
 * Its numbers change only when a post does, and a change made in the app invalidates them, so they
 * stay fresh for 5 minutes and aren't fetched again each time the window regains focus.
 */
const SUMMARY_OPTIONS = { staleTime: 5 * 60_000, refetchOnWindowFocus: false } as const;

/**
 * Posts across every location (`GET /posts/calendar`): a month calendar, this month's numbers and
 * each location's activity, with a way into every location's Posts page (where writing, approving
 * and fixing happen). Each day lists its posts in time order.
 *
 * "Needs attention" and each location's problem chips come from its posts summary instead, so they
 * match the location's own Posts page whatever month is open; a location without Google is marked
 * as such rather than as quiet.
 */
function GbpPostsPage() {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const { month, shift, today, from, to } = useMonth();
  const [locationId, setLocationId] = useState("all");
  const calendar = useQuery({
    queryKey: ["posts", "calendar", workspace.organization?.id ?? null, from, to, locationId],
    queryFn: ({ signal }) => getOrganizationPostsCalendar(from, to, locationId === "all" ? undefined : [locationId], signal),
    enabled: workspace.status === "ready" && workspace.locations.length > 0,
    retry: false,
  });

  const locations = useMemo(() => sortRows(workspace.locations, byText((location) => location.businessName)), [workspace.locations]);
  const showingAll = locationId === "all";
  // The calendar's location filter scopes everything under it: the numbers, the Locations list and
  // the summaries those read.
  const scope = useMemo(() => (showingAll ? locations : locations.filter((location) => location.id === locationId)), [locations, locationId, showingAll]);
  // One summary per location in scope (the same cached answer each location's Posts page and
  // Overview read): what needs attention at any time, and whether Google is connected.
  const summaries = useQueries({
    queries: scope.map((location) => ({ ...postsSummaryQuery(location.id), ...SUMMARY_OPTIONS, enabled: workspace.status === "ready" })),
  });
  const items = calendar.data?.items;
  const perLocation = useMemo(() => byLocation(items ?? []), [items]);
  const navLocationId = pickNavLocationId({ activeLocationId: workspace.activeLocation?.id, locationIds: locations.map((location) => location.id) });
  const monthName = MONTH_NAME.format(month);

  const header = (
    <PageHeader
      icon={CalendarDays}
      tone="posts"
      title="Posts calendar"
      description="Scheduled and published Google posts across all your locations. Open a location to write, approve or fix its posts."
      actions={
        locations.length > 0 ? (
          <>
            {navLocationId ? (
              <Button asChild variant="outline">
                <Link to={locationPath(navLocationId, "ai/posts")}>
                  <Sparkles aria-hidden className="text-ai" /> AI Posts
                </Link>
              </Button>
            ) : null}
            {canEdit ? <NewPostButton locations={locations} /> : null}
          </>
        ) : undefined
      }
    />
  );

  if (workspace.status === "loading") {
    return (
      <>
        {header}
        <PageSkeleton header={false} metrics={4} rows={5} columns={7} />
      </>
    );
  }

  if (locations.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={MapPin}
          tone="locations"
          title="Add a location to start posting"
          description="Posts are written for each location's Google Business Profile. Add your first location, then write or schedule its posts here."
          action={
            <Button asChild>
              <Link to="/locations/add">
                <Plus aria-hidden /> Add location
              </Link>
            </Button>
          }
        />
      </>
    );
  }

  const list = items ?? [];
  const count = (groups: string[]) => list.filter((item) => groups.includes(POST_GROUP_OF[item.status])).length;
  const published = count(["published"]);
  const upcoming = count(["scheduled"]);

  // Posts summaries, by location (`summaries` follows the order of `scope`).
  const summaryResults = new Map(scope.map((location, index) => [location.id, summaries[index]]));
  const summaryOf = (id: string) => summaryResults.get(id)?.data;
  // A location the summary reports without Google can't post: it is never "quiet".
  const notConnected = (id: string) => summaryOf(id)?.connection.gbp_connected === false;

  // "Needs attention" follows the calendar's location filter, like the month numbers next to it.
  const summariesPending = summaries.some((result) => result.isPending);
  const summariesFailed = summaries.some((result) => result.isError);
  const needing = scope.flatMap((location) => {
    const attention = attentionOf(summaryOf(location.id));
    return attention && attention.problems + attention.waiting > 0 ? [{ id: location.id, ...attention }] : [];
  });
  const problems = needing.reduce((sum, entry) => sum + entry.problems, 0);
  const waiting = needing.reduce((sum, entry) => sum + entry.waiting, 0);
  const attention = problems + waiting;
  const allClear = attention === 0 && !summariesPending && !summariesFailed;
  const onlyNeeding = needing.length === 1 ? needing[0] : undefined;

  const connected = scope.filter((location) => !notConnected(location.id));
  const quiet = showingAll && calendar.isSuccess ? connected.filter((location) => !perLocation.has(location.id)).length : 0;

  return (
    <>
      {header}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiTile
          label={`Published in ${monthName}`}
          value={published}
          icon={CheckCircle2}
          statusTone="success"
          loading={calendar.isPending}
          hint="Live on Google"
        />
        <KpiTile
          label={`Scheduled in ${monthName}`}
          value={upcoming}
          icon={CalendarClock}
          statusTone="info"
          loading={calendar.isPending}
          hint={upcoming ? "Going out on their own" : "Nothing scheduled"}
        />
        <KpiTile
          label="Needs attention"
          value={attention}
          icon={attention ? AlertTriangle : ShieldCheck}
          statusTone={attention ? "warning" : allClear ? "success" : "neutral"}
          loading={summariesPending}
          to={onlyNeeding ? locationPath(onlyNeeding.id, "gbp/posts", attentionTab(onlyNeeding)) : "#locations"}
          hint={
            attention ? (
              <span className="text-warning-foreground">
                {[problems ? `${problems} didn't publish` : null, waiting ? `${waiting} waiting for approval` : null].filter(Boolean).join(" · ")}
              </span>
            ) : allClear ? (
              "All clear"
            ) : (
              "Some locations couldn't be checked"
            )
          }
        />
        {showingAll && locations.length > 1 ? (
          <KpiTile
            label={`Quiet in ${monthName}`}
            value={`${quiet} of ${connected.length}`}
            icon={Moon}
            tone="posts"
            loading={calendar.isPending || summariesPending}
            to="#locations"
            hint={
              connected.length === 0 ? (
                "No location is connected to Google yet"
              ) : quiet ? (
                <span className="text-warning-foreground">Connected locations with no post this month</span>
              ) : connected.length < locations.length ? (
                "Every connected location has posts"
              ) : (
                "Every location has posts"
              )
            }
          />
        ) : (
          <KpiTile label="Locations" value={showingAll ? locations.length : 1} icon={MapPin} tone="locations" to="#locations" hint="See each location's posts" />
        )}
      </div>

      <Panel
        title="Calendar"
        icon={CalendarDays}
        tone="posts"
        description="Every dated post, in time order within each day. Drafts have no date yet."
        actions={
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-full sm:w-64" aria-label="Show posts for">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.businessName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        {calendar.isError ? (
          <ErrorState compact description={postErrorText(calendar.error, "The calendar couldn't be loaded.").message} onRetry={() => void calendar.refetch()} />
        ) : (
          <PostsCalendar
            month={month}
            onShift={shift}
            onToday={today}
            items={items}
            loading={calendar.isPending}
            showLocation={showingAll}
            onOpen={(item) =>
              navigate(locationPath(item.location_id, "gbp/posts", `?tab=${POST_GROUP_OF[item.status]}&post=${encodeURIComponent(item.post_id)}`))
            }
          />
        )}
      </Panel>

      <section id="locations" aria-label="Locations" className="scroll-mt-20">
        <Panel
          title="Locations"
          icon={MapPin}
          tone="locations"
          description={`What each location posted in ${monthName}, and any post that didn't publish or waits for approval. Open one to write, approve or fix its posts.`}
        >
          <ul className="-m-4 divide-y divide-border">
            {scope.map((location) => {
              const stats = perLocation.get(location.id);
              const needs = attentionOf(summaryOf(location.id));
              const unconnected = notConnected(location.id);
              return (
                <li key={location.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{location.businessName}</p>
                    <p className="truncate text-xs text-muted-foreground">{location.area || "No city yet"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {needs?.problems ? (
                      <StatusBadge tone="critical" icon={XCircle} size="sm">
                        {needs.problems} didn't publish
                      </StatusBadge>
                    ) : null}
                    {needs?.waiting ? (
                      <StatusBadge tone="warning" icon={Clock} size="sm">
                        {needs.waiting} waiting for approval
                      </StatusBadge>
                    ) : null}
                    {calendar.isPending ? null : stats ? (
                      <>
                        {stats.published ? (
                          <StatusBadge tone="success" icon={CheckCircle2} size="sm">
                            {stats.published} published
                          </StatusBadge>
                        ) : null}
                        {stats.upcoming ? (
                          <StatusBadge tone="info" icon={CalendarClock} size="sm">
                            {stats.upcoming} scheduled
                          </StatusBadge>
                        ) : null}
                        {stats.next ? <span className="text-xs text-muted-foreground">Next {formatPostMoment(stats.next, { weekday: true })}</span> : null}
                      </>
                    ) : unconnected ? null : (
                      <StatusBadge tone="warning" icon={Moon} size="sm">
                        No posts in {monthName}
                      </StatusBadge>
                    )}
                    {unconnected ? (
                      <StatusBadge tone="neutral" icon={PlugZap} size="sm">
                        Google not connected
                      </StatusBadge>
                    ) : null}
                    <Button asChild size="sm" variant="outline">
                      <Link to={locationPath(location.id, "gbp/posts", attentionTab(needs))}>
                        Open posts <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </section>
    </>
  );
}

/** "New post": straight to the location's editor, or a location picker when there are several. */
function NewPostButton({ locations }: { locations: { id: string; businessName: string; area: string }[] }) {
  const navigate = useNavigate();
  const compose = (id: string) => navigate(locationPath(id, "gbp/posts", "?compose=1"));
  if (locations.length === 1 && locations[0]) {
    const only = locations[0];
    return (
      <Button onClick={() => compose(only.id)}>
        <Plus aria-hidden /> New post
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus aria-hidden /> New post <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Write a post for</DropdownMenuLabel>
        {locations.map((location) => (
          <DropdownMenuItem key={location.id} onSelect={() => compose(location.id)} className="flex-col items-start gap-0">
            <span className="text-sm font-medium text-foreground">{location.businessName}</span>
            {location.area ? <span className="text-xs text-muted-foreground">{location.area}</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default GbpPostsPage;
