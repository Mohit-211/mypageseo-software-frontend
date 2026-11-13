import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  Crosshair,
  Grid3x3,
  Info,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  Repeat,
  SearchX,
  Tags,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ChangeLabel, OverallRank, RankBucket, RankCell, RankStatus, RankStatusText, RunMeta } from "@/api";
import { PageHeader, TrendIndicator } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import type { ModuleTone } from "@/components/layout/shared/module-tone";
import { GroupFilter } from "@/components/keywords/group-filter";
import { BackgroundActivity } from "@/components/location/background-activity";
import { ChangeCenterButton } from "@/components/location/change-center-dialog";
import { FirstRunProgress } from "@/components/ranking/first-run-progress";
import { GridSettingsButton } from "@/components/ranking/grid-settings-dialog";
import { RankReportButton } from "@/components/report/rank-report-button";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanEdit } from "@/hooks/use-access";
import { bandFor, BAND_PILL } from "@/lib/keywords/bands";
import { keywordsPath } from "@/lib/keywords/paths";
import { locationSetupPath } from "@/lib/locations/location-actions";
import {
  BUCKET_CLASS,
  BUCKET_LABEL,
  BUCKET_SAMPLE,
  CHANGE_LABEL_TEXT,
  RANKINGS_SOURCE_NOTE,
  RANK_STATUS_TEXT,
  avgRankText,
  centerDescription,
  comparableNote,
  formatDistance,
  formatRunDate,
} from "@/lib/rankings/format";
import { GLOSSARY } from "@/lib/rankings/glossary";
import { useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { rankingErrorState, useRankRuns } from "@/lib/rankings/use-rankings";
import { refreshLabel, useRefreshRankings } from "@/lib/rankings/use-refresh-rankings";
import { cn } from "@/lib/utils";

function cellTitle(cell: RankCell) {
  if (cell.status === "error") return "We couldn't get results from Google for this point";
  const parts = [BUCKET_LABEL[cell.bucket] ?? cell.bucket];
  if (cell.samples && cell.samples.length > 1) {
    const samples = cell.samples.map((value) => (value == null ? "failed" : value === 61 ? "60+" : String(value)));
    parts.push(`samples ${samples.join(", ")}${cell.spread != null ? ` (spread ${cell.spread})` : ""}`);
  }
  return parts.join(" · ");
}

/** One rank, coloured by bucket. A failed search shows "–", never "60+". */
export function RankCellView({ cell, className }: { cell: RankCell | undefined; className?: string }) {
  if (!cell) return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  const text = cell.status === "error" ? "–" : cell.status === "not_found" ? "60+" : cell.display;
  return (
    <span
      title={cellTitle(cell)}
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        BUCKET_CLASS[cell.bucket] ?? BUCKET_CLASS.error,
        className,
      )}
    >
      {text}
      {cell.status === "error" ? <span className="sr-only">search failed</span> : null}
    </span>
  );
}

const LEGEND_BUCKETS: RankBucket[] = ["pack", "visible", "low", "invisible", "not_found", "error"];

/**
 * The rank colours, explained once under a table or grid. Each key is a mini pill with a sample value,
 * the way the cells look (a pale swatch alone barely shows on the footer, and it hides the coloured
 * numeral that tells the pills apart).
 */
export function BucketLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)} aria-label="Rank colours">
      {LEGEND_BUCKETS.map((bucket) => (
        <li key={bucket} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("inline-flex min-w-7 items-center justify-center rounded-md border px-1 text-xs font-semibold tabular-nums", BUCKET_CLASS[bucket])}
          >
            {BUCKET_SAMPLE[bucket]}
          </span>
          {BUCKET_LABEL[bucket]}
        </li>
      ))}
    </ul>
  );
}

/**
 * `change` is previous − current: positive means improved. Null = no comparable earlier run.
 * `neutral` (a competitor's row) shows the movement in grey: a competitor slipping isn't bad news.
 */
export function RankChange({
  change,
  label,
  neutral = false,
}: {
  change: number | null | undefined;
  label?: ChangeLabel | null | undefined;
  neutral?: boolean;
}) {
  if (label === "entered_top_60" || label === "dropped_out_of_top_60") {
    return (
      <StatusBadge tone={neutral ? "neutral" : label === "entered_top_60" ? "success" : "critical"} size="sm">
        {CHANGE_LABEL_TEXT[label]}
      </StatusBadge>
    );
  }
  if (change == null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <TrendIndicator
      variant="chip"
      direction={change > 0 ? "up" : change < 0 ? "down" : "flat"}
      value={Math.abs(change).toFixed(1)}
      positive={change > 0}
      tone={neutral ? "neutral" : "auto"}
    />
  );
}

/** Overall change, noting when it covers only some keywords (after keyword edits). `neutral` as on RankChange. */
export function OverallChange({ overall, neutral = false }: { overall: OverallRank | undefined; neutral?: boolean }) {
  if (!overall || overall.comparable_keywords === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const note = comparableNote(overall.comparable_keywords, overall.keywords_total);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <RankChange change={overall.change} neutral={neutral} />
      {note && overall.change != null ? <span className="text-xs text-muted-foreground">({note})</span> : null}
    </span>
  );
}

/** An average rank with its status: "60+" (not in the top 60) and "No data" (searches failed) read differently. */
export function AvgRank({
  value,
  status,
  display,
  statusText,
}: {
  value: number | null | undefined;
  status?: RankStatus | null | undefined;
  display?: string | null | undefined;
  statusText?: RankStatusText | undefined;
}) {
  const text = avgRankText(value, status, display);
  const tip = status ? (statusText?.[status] ?? RANK_STATUS_TEXT[status]).tooltip : value == null ? "Not measured yet" : undefined;
  return (
    <span
      title={tip}
      className={cn("font-semibold tabular-nums", status === "no_data" ? "text-xs font-medium text-muted-foreground" : "text-foreground")}
    >
      {text}
    </span>
  );
}

/**
 * An average rank as a soft pill in its band colour (top 3 green, 4–10 blue, 11–20 amber, 21+ red,
 * "60+" grey), the way keyword tables show a keyword's position at a glance.
 */
export function AvgRankPill({
  value,
  status,
  display,
  statusText,
  className,
}: {
  value: number | null | undefined;
  status?: RankStatus | null | undefined;
  display?: string | null | undefined;
  statusText?: RankStatusText | undefined;
  className?: string;
}) {
  const text = avgRankText(value, status, display);
  const band = bandFor({ avgRank: value ?? null, status: status ?? null, foundRate: null, top3Rate: null }, value != null || Boolean(status));
  const tip = status ? (statusText?.[status] ?? RANK_STATUS_TEXT[status]).tooltip : value == null ? "Not measured yet" : undefined;
  return (
    <span
      title={tip}
      className={cn(
        "inline-flex min-w-12 items-center justify-center rounded-md border px-2 py-0.5 text-sm font-semibold tabular-nums",
        value == null && !status ? "border-dashed border-border-strong bg-card text-muted-foreground" : BAND_PILL[band],
        status === "no_data" && "text-xs font-medium",
        className,
      )}
    >
      {value == null && !status ? "—" : text}
    </span>
  );
}

/**
 * The error states shared by the ranking pages, chosen by `data.reason`. While the
 * first run is in progress it shows its progress and reloads once a run is done.
 */
export function RankingsError({
  error,
  locationId,
  onRetry,
  onLatest,
  onClearKeyword,
  onClearGroup,
  onPoint,
}: {
  error: unknown;
  locationId: string;
  onRetry: () => void;
  onLatest: () => void;
  onClearKeyword?: () => void;
  onClearGroup?: () => void;
  onPoint?: (point: string) => void;
}) {
  const state = rankingErrorState(error);
  switch (state.kind) {
    case "no_completed_run":
      return <FirstRunPending locationId={locationId} />;
    case "location_not_found":
      return (
        <EmptyState
          variant="no-results"
          title="Location not found"
          description="It may have been deleted, or it isn't in this organization."
          action={
            <Button asChild variant="outline">
              <Link to="/locations">
                <ArrowLeft aria-hidden /> Back to locations
              </Link>
            </Button>
          }
        />
      );
    case "run_not_found":
      return (
        <EmptyState
          variant="no-results"
          title="Run not found"
          description="That ranking run doesn't exist for this location."
          action={<Button variant="outline" onClick={onLatest}>Show the latest results</Button>}
        />
      );
    case "run_not_finished":
      return (
        <EmptyState
          variant="unavailable"
          tone="rankings"
          title="This run hasn't finished"
          description={`The selected run is ${state.status ?? "still in progress"}. Its results appear once it's done.`}
          action={<Button variant="outline" onClick={onLatest}>Show the latest results</Button>}
        />
      );
    case "group_not_found":
      return (
        <EmptyState
          variant="no-results"
          title="Keyword group not found"
          description="It may have been deleted. Show every keyword instead."
          action={onClearGroup ? <Button variant="outline" onClick={onClearGroup}>Show all keywords</Button> : undefined}
        />
      );
    case "keyword_not_in_run":
      return (
        <EmptyState
          variant="no-results"
          icon={SearchX}
          title="Keyword not in this run"
          description="The keyword was added or removed after this run. Choose another keyword or run."
          action={onClearKeyword ? <Button variant="outline" onClick={onClearKeyword}>Show all keywords</Button> : undefined}
        />
      );
    case "point_not_in_run":
      return (
        <EmptyState
          variant="no-results"
          title="This point wasn't searched in this run"
          description={state.available.length > 0 ? `Available points: ${state.available.join(", ")}.` : "Older runs only have the center point."}
          action={
            onPoint && state.available[0] ? (
              <Button variant="outline" onClick={() => onPoint(state.available[0]!)}>
                Show {state.available[0]}
              </Button>
            ) : undefined
          }
        />
      );
    default:
      return <ErrorState description="Rankings couldn't be loaded. Try again." onRetry={onRetry} />;
  }
}

/**
 * 404 `no_completed_run`: the first run's progress, or "finish setup" when there's no run at all. A
 * read-only client user can't change setup, so they get what's happening and a way to see the keywords.
 */
function FirstRunPending({ locationId }: { locationId: string }) {
  const canEdit = useCanEdit();
  return (
    <FirstRunProgress
      locationId={locationId}
      fallback={
        canEdit ? (
          <EmptyState
            icon={TrendingUp}
            tone="rankings"
            title="No ranking run yet"
            description="Finish this location's setup (keywords and competitors) to start the first ranking run."
            action={
              <Button asChild>
                <Link to={locationSetupPath(locationId)}>Continue setup</Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="outline">
                <Link to={keywordsPath(locationId)}>
                  <Tags aria-hidden /> Manage keywords
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={TrendingUp}
            tone="rankings"
            title="No ranking run yet"
            description="Your agency is finishing this location's setup. Rankings show here after its first ranking run."
            action={
              <Button asChild variant="outline">
                <Link to={keywordsPath(locationId)}>
                  <Tags aria-hidden /> See keywords
                </Link>
              </Button>
            }
          />
        )
      }
    />
  );
}

/** "Latest run" or an older done/partial run from `GET rank-runs`. */
export function RunPicker({
  locationId,
  runId,
  onChange,
}: {
  locationId: string;
  runId: string | undefined;
  onChange: (runId: string | undefined) => void;
}) {
  const runs = useRankRuns(locationId);
  const list = runs.data?.runs ?? [];
  if (list.length <= 1 && !runId) return null;
  const latest = list.find((run) => run.status === "done" || run.status === "partial");
  return (
    <Select value={runId ?? "latest"} onValueChange={(value) => onChange(value === "latest" ? undefined : value)}>
      <SelectTrigger className="h-9 w-full justify-start sm:w-64 [&>svg:last-child]:ml-auto" aria-label="Ranking run">
        <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Latest run" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="latest">Latest run{latest ? ` · ${formatRunDate(latest.run_at)}` : ""}</SelectItem>
        {list.map((run) => {
          const usable = run.status === "done" || run.status === "partial";
          return (
            <SelectItem key={run.run_id} value={run.run_id} disabled={!usable}>
              {formatRunDate(run.run_at, true)}
              {usable ? ` · avg ${avgRankText(run.overall.self?.overallAvgRank, run.overall.self?.status, run.overall.self?.display)}` : ` · ${run.status}`}
              {run.status === "partial" ? " (partial)" : ""}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** Manual rankings refresh: costs tokens, at most once per 24 h; the monthly refresh is free. */
function RefreshRankingsButtonEditor({ locationId, label }: { locationId: string; label?: string }) {
  const refresh = useRefreshRankings(locationId);
  return (
    <Button
      variant="outline"
      disabled={!refresh.canStart}
      aria-busy={refresh.starting || undefined}
      title={
        refresh.blockedReason ??
        (refresh.waitingUntil ? "A manual refresh is allowed once every 24 hours. The automatic monthly run is free." : undefined)
      }
      onClick={() => void refresh.start()}
    >
      {refresh.active || refresh.starting ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
      {refreshLabel(refresh, label)}
    </Button>
  );
}

/** Hidden for a read-only client_user. */
export function RefreshRankingsButton(props: ComponentProps<typeof RefreshRankingsButtonEditor>) {
  return useCanEdit() ? <RefreshRankingsButtonEditor {...props} /> : null;
}

/** One fact in the "About this data" popover. */
function AboutRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}

/**
 * The run, grid, center and data source behind a ranking page, one click away instead of a block
 * of small print under every title.
 */
function AboutRankingData({ locationId, run, scope }: { locationId: string; run: RunMeta | undefined; scope: string | null | undefined }) {
  const { location } = useRankingsContext();
  const refresh = useRefreshRankings(locationId);
  // The run's own center (frozen with it); older runs fall back to the location's current one.
  const measuredAround = centerDescription(run?.center?.source ? run.center : location.center);
  const radius = run?.config.radius_km;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Info aria-hidden className="size-3.5" /> About this data
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">About this data</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{RANKINGS_SOURCE_NOTE}</p>
        </div>
        <dl className="space-y-3 px-4 py-3">
          {run ? (
            <AboutRow icon={CalendarClock} label="Ranking run">
              {formatRunDate(run.run_at, true)}
              {run.status === "partial" ? (
                <span className="mt-0.5 block text-xs text-warning-foreground">Partial: some searches failed, and those points show “–”.</span>
              ) : null}
            </AboutRow>
          ) : null}
          {run ? (
            <AboutRow icon={Grid3x3} label="Grid">
              {run.config.grid_size}×{run.config.grid_size} points,{" "}
              {radius ? `${formatDistance(radius)} from center to edge` : `${run.config.spacing_km} km apart`}
            </AboutRow>
          ) : null}
          {scope || measuredAround ? (
            <AboutRow icon={Crosshair} label="Measured">
              {scope ?? measuredAround?.replace(/^Measured around: /, "Around ")}
            </AboutRow>
          ) : null}
          <AboutRow icon={Repeat} label="Updates">
            {refresh.nextAutomaticRun
              ? `Automatically every month, for free. Next run ${formatRunDate(refresh.nextAutomaticRun)}.`
              : "Automatic monthly runs are off; refresh by hand."}
            {refresh.cost != null ? ` A manual refresh costs ${refresh.cost} token${refresh.cost === 1 ? "" : "s"}.` : ""}
          </AboutRow>
        </dl>
        <p className="border-t border-border bg-surface-strong px-4 py-3 text-xs text-muted-foreground">{GLOSSARY.businessCenter}</p>
      </PopoverContent>
    </Popover>
  );
}

/** "Around your Google Maps pin" / "Around Tampa, FL": the center in a few words for the meta line. */
function shortCenter(center: { source?: string | null; label?: string | null } | null | undefined): string | null {
  if (!center?.source) return null;
  if (center.source === "place") return "Your Google Maps pin";
  return center.label ? `Around ${center.label}` : "Around the chosen city or ZIP";
}

/**
 * Header shared by the ranking pages: PageHeader v2 (TrendingUp, rankings tone), a one-line summary
 * of the data with an "About this data" popover, the page's actions (Manage keywords, Refresh, Report)
 * and a toolbar row (group filter, run picker, grid settings).
 */
export function RankingsPageHeader({
  locationId,
  title,
  description,
  run,
  scope,
  actions,
  groupFilter = false,
  keywordsLink = true,
  icon = TrendingUp,
  tone = "rankings",
}: {
  locationId: string;
  /** @deprecated The rankings tab bar is gone (the sidebar navigates between ranking pages); ignored. */
  view?: string;
  title: string;
  description: string;
  run?: RunMeta | undefined;
  /** What this page measured (`scope.description`), shown in "About this data". */
  scope?: string | null | undefined;
  /** Extra secondary actions, before the report button (e.g. "Manage competitors"). */
  actions?: ReactNode;
  /** Show the keyword-group filter (Rank Overview, Rank Tracker, grid). */
  groupFilter?: boolean;
  /** Show "Manage keywords" (default). */
  keywordsLink?: boolean;
  /** The page's module icon and tone (Competitors uses its own). */
  icon?: LucideIcon;
  tone?: ModuleTone;
}) {
  const [runId, setRunId] = useRunParam();
  const { location } = useRankingsContext();
  const canEdit = useCanEdit();
  const around = shortCenter(run?.center?.source ? run.center : location.center);

  return (
    <>
      <PageHeader
        icon={icon}
        tone={tone}
        title={title}
        description={description}
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {run ? (
              <span className="inline-flex items-center gap-1.5" title={formatRunDate(run.run_at, true)}>
                <CalendarClock aria-hidden className="size-3.5" />
                {runId ? "Run of" : "Updated"} {formatRunDate(run.run_at)}
              </span>
            ) : null}
            {run?.status === "partial" ? (
              <StatusBadge tone="warning" size="sm" icon={TriangleAlert}>
                Partial run
              </StatusBadge>
            ) : null}
            {run ? (
              <span className="inline-flex items-center gap-1.5">
                <Grid3x3 aria-hidden className="size-3.5" />
                {run.config.grid_size}×{run.config.grid_size} grid
              </span>
            ) : null}
            {around ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPinned aria-hidden className="size-3.5" />
                {around}
                {location.center?.source ? <ChangeCenterButton locationId={locationId} label="Change center" className="h-auto p-0 text-xs" /> : null}
              </span>
            ) : null}
            <AboutRankingData locationId={locationId} run={run} scope={scope} />
          </div>
        }
        actions={
          <>
            {keywordsLink ? (
              <Button asChild variant="outline">
                <Link to={keywordsPath(locationId)}>
                  {/* A read-only client user can look at the keywords but not change them. */}
                  <Tags aria-hidden /> {canEdit ? "Manage keywords" : "See keywords"}
                </Link>
              </Button>
            ) : null}
            {actions}
            <RefreshRankingsButton locationId={locationId} />
            {/* The page's one filled action leads on phones, where the actions stack under the title. */}
            {run && canEdit ? (
              <span className="inline-flex max-sm:order-first">
                <RankReportButton locationId={locationId} runId={run.run_id} runAt={run.run_at} />
              </span>
            ) : null}
          </>
        }
      >
        {groupFilter ? <GroupFilter locationId={locationId} /> : null}
        <RunPicker locationId={locationId} runId={runId} onChange={setRunId} />
        <GridSettingsButton locationId={locationId} />
      </PageHeader>
      <BackgroundActivity locationId={locationId} />
    </>
  );
}
