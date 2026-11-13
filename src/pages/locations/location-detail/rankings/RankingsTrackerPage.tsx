import { Link, useLocation } from "react-router-dom";
import { FolderTree, Trophy } from "lucide-react";
import type { RankTrackerResponse, TrackerPointLabel } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { EmptyState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { InfoTip } from "@/components/layout/shared/info-tip";
import { SortableTh, TableScroll, thClass } from "@/components/layout/shared/data-table";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { RankTrendChart } from "@/components/ranking/rank-charts";
import { AvgRank, AvgRankPill, BucketLegend, OverallChange, RankCellView, RankChange, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanEdit } from "@/hooks/use-access";
import { keywordsPath } from "@/lib/keywords/paths";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { avgRankText, formatRate, targetLabel } from "@/lib/rankings/format";
import { GLOSSARY, pointExplanation } from "@/lib/rankings/glossary";
import { RANK_COLUMN_FIRST_ORDER, byRank, leaderboard, sortRankRows, useSortState, type RankColumn } from "@/lib/rankings/rank-sort";
import { useGroupParam, useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useRankRuns, useRankTracker } from "@/lib/rankings/use-rankings";
import { byText, sortRows, type SortDirection } from "@/lib/sort";
import { cn } from "@/lib/utils";

const POINTS: TrackerPointLabel[] = ["C", "N", "S", "E", "W"];

/** The keyword sorts offered on phones, where the list has no column headers to click. */
const PHONE_SORTS: { value: `${RankColumn}:${SortDirection}`; label: string }[] = [
  { value: "rank:asc", label: "Best rank first" },
  { value: "rank:desc", label: "Worst rank first" },
  { value: "change:desc", label: "Most improved first" },
  { value: "change:asc", label: "Biggest drops first" },
  { value: "top3:desc", label: "Most often in the top 3" },
  { value: "keyword:asc", label: "Keyword, A–Z" },
];

/** Rank Tracker: the overall leaderboard, the trend, groups, and each keyword at the 5 tracker points. */
function RankingsTrackerPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const [group, setGroup] = useGroupParam();
  const tracker = useRankTracker(location.location_id, runId, group);

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        title="Rank Tracker"
        description="Your average Google Maps rank for each keyword, from the center and 4 points around your business."
        run={tracker.data?.run}
        scope={tracker.data?.scope?.description}
        groupFilter
      />
      {tracker.isPending ? (
        <PageSkeleton header={false} metrics={0} rows={10} columns={8} />
      ) : tracker.isError ? (
        <RankingsError
          error={tracker.error}
          locationId={location.location_id}
          onRetry={() => void tracker.refetch()}
          onLatest={() => setRunId(undefined)}
          onClearGroup={() => setGroup(undefined)}
        />
      ) : (
        <TrackerContent data={tracker.data} locationId={location.location_id} selfName={location.name} onClearGroup={() => setGroup(undefined)} />
      )}
    </>
  );
}

function TrackerContent({
  data,
  locationId,
  selfName,
  onClearGroup,
}: {
  data: RankTrackerResponse;
  locationId: string;
  selfName: string;
  onClearGroup: () => void;
}) {
  const runs = useRankRuns(locationId, 12);
  const canEdit = useCanEdit();
  const { pathname, search } = useLocation();
  const { sort, order, onSort, setSort } = useSortState<RankColumn>("rank", RANK_COLUMN_FIRST_ORDER);
  const phoneSort = `${sort}:${order}`;
  const name = (key: string, raw?: string | null) => targetLabel(key, selfName, raw);
  // Leaderboard: every business ranked together, best first; you stay in your place, highlighted.
  const board = leaderboard(data.targets, (target) => {
    const overall = data.overall[target.key];
    return overall ? { avgRank: overall.overallAvgRank, status: overall.status } : null;
  }, (target) => name(target.key, target.name));
  const groups = sortRows(data.groups ?? [], byRank((entry) => entry.summary.self), byText((entry) => entry.name));
  const keywords = sortRankRows(data.keywords, sort, order, { keyword: (row) => row.keyword, summary: (row) => row.summary.self });
  const self = data.overall.self;
  const total = self?.keywords_total ?? data.keywords.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel
          title="Overall average rank"
          description={`Across ${total} keyword${total === 1 ? "" : "s"}. Lower is better.`}
          icon={Trophy}
          tone="rankings"
          actions={<InfoTip label="About the average rank">{GLOSSARY.avgRank}</InfoTip>}
        >
          <ol className="-mx-4 -my-2 divide-y divide-border">
            {board.map((target, index) => {
              const overall = data.overall[target.key];
              const you = target.key === "self";
              return (
                <li
                  key={target.key}
                  className={cn("flex items-center gap-3 px-4 py-2.5", you && "bg-brand-tint/70 shadow-[inset_3px_0_0_var(--color-primary)]")}
                >
                  <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">#{index + 1}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={cn("min-w-0 truncate text-sm", you ? "font-semibold text-foreground" : "text-foreground")}>
                      {name(target.key, target.name)}
                    </span>
                    {you ? (
                      <StatusBadge tone="brand" size="sm">
                        You
                      </StatusBadge>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={cn("tabular-nums", you ? "text-lg font-semibold text-foreground" : "text-sm font-semibold text-foreground")} title={overall?.status ? data.status_text?.[overall.status]?.tooltip : undefined}>
                      {avgRankText(overall?.overallAvgRank, overall?.status, overall?.display)}
                    </span>
                    <OverallChange overall={overall} neutral={!you} />
                  </span>
                </li>
              );
            })}
          </ol>
          {board.length <= 1 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              No competitors tracked yet.
              {/* A read-only client user gets no link into the (editable) setup wizard. */}
              {canEdit ? (
                <>
                  {" "}
                  {/* `from`: Save and Cancel come back here, not to Competitors. */}
                  <Link
                    to={`${locationSetupPath(locationId)}?step=competitors&from=${encodeURIComponent(pathname + search)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    Add competitors
                  </Link>{" "}
                  to see who ranks above you.
                </>
              ) : null}
            </p>
          ) : null}
        </Panel>
        <Panel title="Trend" description="Overall average rank per run. Lower is better.">
          <RankTrendChart runs={runs.data?.runs ?? null} selfName={selfName} />
        </Panel>
      </div>

      {groups.length > 0 ? (
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold leading-6 text-foreground">
                <FolderTree aria-hidden className="size-4 text-chart-3" /> Keyword groups
              </h2>
              <p className="text-[13px] text-muted-foreground">How each group ranks in this run, best first.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={keywordsPath(locationId, { section: "groups" })}>{canEdit ? "Manage groups" : "See groups"}</Link>
            </Button>
          </div>
          {/* Phones keep Group, Avg. rank and Change; the keyword count and Top 3 join from `sm`. */}
          <TableScroll minWidth={320} label="Keyword groups">
            <thead className="bg-surface-strong">
              <tr className="border-b border-border-strong">
                <th scope="col" className={thClass}>Group</th>
                <th scope="col" className={cn(thClass, "hidden text-right sm:table-cell")}>Keywords</th>
                <th scope="col" className={cn(thClass, "text-right")}>Avg. rank</th>
                <th scope="col" className={thClass}>Change</th>
                <th scope="col" className={cn(thClass, "hidden text-right sm:table-cell")}>Top 3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((entry) => {
                const summary = entry.summary.self;
                const active = data.group?.group_id === entry.group_id;
                return (
                  <tr key={entry.group_id} data-selected={active ? "true" : undefined} className="transition-colors hover:bg-accent/60 data-[selected=true]:bg-brand-tint">
                    <td className="px-4 py-3 font-medium text-foreground">{entry.name}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {entry.keywords_in_run}
                      {entry.keywords_in_run !== entry.keywords.length ? ` of ${entry.keywords.length}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AvgRankPill value={summary?.avgRank} status={summary?.status} display={summary?.display} statusText={data.status_text} className="text-xs" />
                    </td>
                    <td className="px-4 py-3">
                      <RankChange change={summary?.change} />
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-foreground sm:table-cell">{formatRate(summary?.top3Rate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableScroll>
        </section>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-6 text-foreground">{data.group ? `Keywords in “${data.group.name}”` : "Keywords"}</h2>
            <p className="text-[13px] text-muted-foreground">
              Your rank from 5 search spots: the center (C) and {data.run.config.tracker_offset_km} km north, south, east and west. Select a keyword for every competitor and its history.
            </p>
          </div>
          {/* Phones get a list instead of the table, so the column sort moves into a select. */}
          {data.keywords.length > 0 ? (
            <Select
              value={PHONE_SORTS.some((option) => option.value === phoneSort) ? phoneSort : ""}
              onValueChange={(value) => {
                const [field, direction] = value.split(":") as [RankColumn, SortDirection];
                setSort({ sort: field, order: direction });
              }}
            >
              <SelectTrigger className="w-full sm:hidden" aria-label="Sort keywords">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {PHONE_SORTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        {data.keywords.length === 0 ? (
          <EmptyState
            variant="no-results"
            title="No keywords of this group in this run"
            description="The group's keywords were added after this run, or the group changed."
            action={<Button variant="outline" size="sm" onClick={onClearGroup}>Show all keywords</Button>}
          />
        ) : (
          <>
            {/* Phones: one row per keyword (rank and change first, then the 5 spots), so nothing is cut at the card edge. */}
            <ul className="divide-y divide-border sm:hidden" aria-label="Keyword ranks">
              {keywords.map((keyword) => {
                const summary = keyword.summary.self;
                return (
                  <li key={keyword.keyword} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        to={keywordsPath(locationId, { keyword: keyword.keyword })}
                        className="-my-1.5 inline-flex min-h-9 min-w-0 items-center break-words text-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                      >
                        {keyword.keyword}
                      </Link>
                      <span className="flex shrink-0 items-center gap-2">
                        <AvgRank value={summary?.avgRank} status={summary?.status} display={summary?.display} statusText={data.status_text} />
                        <RankChange change={summary?.change} label={summary?.changeLabel} />
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Found <span className="tabular-nums text-foreground">{formatRate(summary?.foundRate)}</span> · Top 3{" "}
                      <span className="tabular-nums text-foreground">{formatRate(summary?.top3Rate)}</span>
                    </p>
                    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="Rank at each search spot">
                      {POINTS.map((point) => (
                        <li key={point} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                          {point}
                          <RankCellView cell={keyword.cells.find((cell) => cell.point.label === point)?.byTarget.self} />
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
            <div className="hidden sm:block">
              <TableScroll minWidth={820} label="Keyword ranks">
                <thead className="bg-surface-strong">
                  <tr className="border-b border-border-strong">
                    <SortableTh label="Keyword" value="keyword" active={sort} order={order} onSort={onSort} />
                    {/* One line, so the sort arrow stays beside the label instead of floating on the left. */}
                    <SortableTh label="Avg. rank" value="rank" active={sort} order={order} onSort={onSort} align="right" className="whitespace-nowrap" />
                    <SortableTh label="Change" value="change" active={sort} order={order} onSort={onSort} />
                    <SortableTh label="Found" value="found" active={sort} order={order} onSort={onSort} align="right" />
                    <SortableTh label="Top 3" value="top3" active={sort} order={order} onSort={onSort} align="right" />
                    {POINTS.map((point) => (
                      <th key={point} scope="col" className={cn(thClass, "px-2 text-center")}>
                        <span className="inline-flex items-center gap-0.5">
                          {point}
                          <InfoTip label={`About point ${point}`}>{pointExplanation(point, data.run.config.tracker_offset_km)}</InfoTip>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {keywords.map((keyword) => {
                    const summary = keyword.summary.self;
                    return (
                      <tr key={keyword.keyword} className="transition-colors hover:bg-accent/60">
                        <td className="px-4 py-3">
                          <Link
                            to={keywordsPath(locationId, { keyword: keyword.keyword })}
                            className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                          >
                            {keyword.keyword}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <AvgRank value={summary?.avgRank} status={summary?.status} display={summary?.display} statusText={data.status_text} />
                        </td>
                        <td className="px-4 py-3">
                          <RankChange change={summary?.change} label={summary?.changeLabel} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatRate(summary?.foundRate)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatRate(summary?.top3Rate)}</td>
                        {POINTS.map((point) => (
                          <td key={point} className="px-2 py-3 text-center">
                            <RankCellView cell={keyword.cells.find((cell) => cell.point.label === point)?.byTarget.self} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </TableScroll>
            </div>
          </>
        )}
        <div className="border-t border-border bg-surface-strong px-4 py-3">
          <BucketLegend />
        </div>
      </section>
    </div>
  );
}

export default RankingsTrackerPage;
