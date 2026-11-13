import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  FolderPlus,
  Grid3x3,
  LineChart,
  Map as MapIcon,
  MessageSquareReply,
  PenLine,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { KeywordGroup, RankStatusText, RankTrackerResponse, TrackerPointLabel } from "@/api";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { InfoTip } from "@/components/layout/shared/info-tip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { KeywordHistoryChart } from "@/components/ranking/rank-charts";
import { AvgRank, AvgRankPill, BucketLegend, RankCellView, RankChange } from "@/components/ranking/rank-ui";
import { TermChange } from "@/components/keywords/term-change";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatMonth } from "@/lib/datetime";
import { groupHas } from "@/lib/keywords/groups";
import { aiPostsPath, rankingsPagePath } from "@/lib/keywords/paths";
import { searchCountText } from "@/lib/keywords/search-terms";
import { postUsageText, replyUsageText } from "@/lib/keywords/usage-rules";
import { useKeywordHistory, type KeywordRow, type TrackerState } from "@/lib/keywords/use-keywords";
import { formatRate, formatRunDate, targetLabel } from "@/lib/rankings/format";
import { GLOSSARY, pointExplanation } from "@/lib/rankings/glossary";
import { leaderboard } from "@/lib/rankings/rank-sort";
import { isApiError } from "@/api";
import { cn } from "@/lib/utils";
import type { KeywordRowActions } from "./keywords-table";

const POINTS: TrackerPointLabel[] = ["C", "N", "S", "E", "W"];

/**
 * One keyword in depth (`?keyword=` on the Keywords page): where it ranks now, every tracked
 * business at the 5 search spots, its history, Google searches, how AI uses it, and what to do next.
 */
export function KeywordDetailSheet({
  locationId,
  open,
  keyword,
  row,
  total,
  run,
  trackerState,
  selfName,
  canEdit,
  groups,
  searchesMonth,
  nextRunAt,
  actions,
  onTrack,
  onClose,
  onClosed,
}: {
  locationId: string;
  open: boolean;
  /** The keyword shown. It stays set while the sheet slides closed, so the sheet never goes blank. */
  keyword: string | null;
  /** Its row, when it is tracked. */
  row: KeywordRow | null;
  total: number;
  run: RankTrackerResponse | null;
  trackerState: TrackerState;
  selfName: string;
  canEdit: boolean;
  groups: readonly KeywordGroup[];
  searchesMonth: string | null;
  nextRunAt: string | null;
  actions: KeywordRowActions;
  /** Track a keyword that isn't tracked (an old link). */
  onTrack: (keyword: string) => void;
  /** Escape, the overlay or the close button. */
  onClose: () => void;
  /** After the sheet has slid closed (its close-focus event): the moment to change the address. */
  onClosed: (event: Event) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-3xl" onCloseAutoFocus={onClosed}>
        {keyword !== null && row ? (
          <KeywordDetail
            locationId={locationId}
            row={row}
            total={total}
            run={run}
            trackerState={trackerState}
            selfName={selfName}
            canEdit={canEdit}
            groups={groups}
            searchesMonth={searchesMonth}
            nextRunAt={nextRunAt}
            actions={actions}
          />
        ) : keyword !== null ? (
          <div className="p-6">
            <SheetHeader className="mb-6 pr-8">
              <SheetTitle>“{keyword}”</SheetTitle>
              <SheetDescription>This keyword isn't tracked for this location.</SheetDescription>
            </SheetHeader>
            <EmptyState
              icon={Search}
              tone="keywords"
              title="Not tracked"
              description={
                canEdit
                  ? "Track it to see where you rank for it. It's measured from the next ranking run, and AI posts and replies can use it."
                  : "Someone with edit access can add it to this location's keywords."
              }
              action={
                canEdit ? (
                  <Button onClick={() => onTrack(keyword)}>
                    <Plus aria-hidden /> Track “{keyword}”
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function KeywordDetail({
  locationId,
  row,
  total,
  run,
  trackerState,
  selfName,
  canEdit,
  groups,
  searchesMonth,
  nextRunAt,
  actions,
}: {
  locationId: string;
  row: KeywordRow;
  total: number;
  run: RankTrackerResponse | null;
  trackerState: TrackerState;
  selfName: string;
  canEdit: boolean;
  groups: readonly KeywordGroup[];
  searchesMonth: string | null;
  nextRunAt: string | null;
  actions: KeywordRowActions;
}) {
  const self = row.self;
  const history = useKeywordHistory(locationId, row.text);
  const historyGone = isApiError(history.error) && history.error.reason === "keyword_not_tracked";
  const freeGroups = groups.filter((group) => !groupHas(group, row.text));

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border bg-surface-strong px-5 pb-5 pt-6 sm:px-6">
        <SheetHeader className="space-y-1 pr-8 text-left">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1 text-chart-3">
              <Search aria-hidden className="size-3.5" /> Keyword
            </span>
            <span aria-hidden>·</span>
            <span>
              #{row.position + 1} of {total} in your order
            </span>
            {!row.measured ? (
              <StatusBadge tone="info" size="sm">
                New
              </StatusBadge>
            ) : null}
          </p>
          <SheetTitle className="text-xl leading-snug">{row.text}</SheetTitle>
          <SheetDescription>
            {row.measured && run
              ? `From the ranking run of ${formatRunDate(run.run.run_at)}: your average Google Maps position across 5 search spots.`
              : `Added after the last ranking run. It's measured from the next run${nextRunAt ? ` (${formatRunDate(nextRunAt)})` : ""}.`}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {row.groups.map((group) => (
            <Badge key={group.group_id} variant="neutral">
              {group.name}
            </Badge>
          ))}
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <FolderPlus aria-hidden /> {row.groups.length > 0 ? "Add to another group" : "Add to a group"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {freeGroups.map((group) => (
                  <DropdownMenuItem key={group.group_id} onSelect={() => actions.addToGroup(row, group)}>
                    <span className="truncate">{group.name}</span>
                  </DropdownMenuItem>
                ))}
                {freeGroups.length > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem onSelect={() => actions.newGroup(row)}>
                  <FolderPlus aria-hidden /> New group…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Avg. rank" tip={GLOSSARY.avgRank}>
            {row.measured ? (
              <AvgRankPill value={self?.avgRank} status={self?.status} display={self?.display} statusText={run?.status_text} className="text-base" />
            ) : (
              <span className="text-sm text-muted-foreground">Next run</span>
            )}
          </Stat>
          <Stat label="Change" tip={GLOSSARY.change}>
            {row.measured ? <RankChange change={self?.change} label={self?.changeLabel} /> : <span className="text-sm text-muted-foreground">—</span>}
          </Stat>
          <Stat label="Found" tip={GLOSSARY.found}>
            <span className="text-lg font-semibold tabular-nums text-foreground">{row.measured ? formatRate(self?.foundRate) : "—"}</span>
          </Stat>
          <Stat label="Top 3" tip={GLOSSARY.top3}>
            <span className="text-lg font-semibold tabular-nums text-foreground">{row.measured ? formatRate(self?.top3Rate) : "—"}</span>
          </Stat>
        </dl>
      </div>

      <div className="flex-1 space-y-6 px-5 py-5 sm:px-6">
        {row.entry && run ? (
          <Section icon={Users} title="You and your competitors" description={`Each business at the center (C) and ${run.run.config.tracker_offset_km} km north, south, east and west.`}>
            <CompetitorBreakdown entry={row.entry} run={run} selfName={selfName} canEdit={canEdit} />
          </Section>
        ) : trackerState === "loading" ? null : (
          <Section icon={Users} title="You and your competitors">
            <p className="rounded-lg border border-dashed border-border-strong px-4 py-5 text-center text-sm text-muted-foreground">
              {trackerState === "error" ? "Ranks couldn't be loaded right now." : "Every tracked business's rank shows here after the next ranking run."}
            </p>
          </Section>
        )}

        <Section icon={LineChart} title="History" description="Average rank per run (lower is better).">
          {historyGone ? (
            <p className="text-sm text-muted-foreground">History isn't available for keywords you no longer track.</p>
          ) : history.isError ? (
            <p className="text-sm text-muted-foreground">The history couldn't be loaded. Close and reopen to try again.</p>
          ) : (
            <KeywordHistoryChart history={history.data} loading={history.isPending} selfName={selfName} height="h-52" />
          )}
        </Section>

        <Section icon={Search} title="Google searches">
          {row.searches ? (
            <p className="text-sm text-foreground">
              <span className="text-lg font-semibold tabular-nums">{searchCountText(row.searches)}</span> searches found your profile
              {searchesMonth ? ` in ${formatMonth(searchesMonth)}` : " last month"}
              {/* Fewer searches is information, not an alarm: grey, as on the Keywords page and GBP Overview. */}
              {row.searches.change != null ? (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <TermChange change={row.searches.change} /> vs the month before
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not among the top searches that found your Google profile last month. Google only reports the most common ones.
            </p>
          )}
        </Section>

        <Section icon={CheckCircle2} title="Where it's used">
          <ul className="space-y-3">
            <UsageLine icon={TrendingUp} tone="text-chart-1" title="Rank tracking">
              {row.measured
                ? `Measured in every run. Last measured ${run ? formatRunDate(run.run.run_at) : "in the latest run"}.`
                : `Measured from the next run${nextRunAt ? ` (${formatRunDate(nextRunAt)})` : ""}.`}
            </UsageLine>
            <UsageLine icon={PenLine} tone="text-ai" title="AI posts">
              {postUsageText(row.position)}
            </UsageLine>
            <UsageLine icon={MessageSquareReply} tone="text-ai" title="AI review replies">
              {replyUsageText(row.position)}
            </UsageLine>
          </ul>
        </Section>
      </div>

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
        {/* Phones get icon buttons (with names for assistive tech), so the bar stays one row. */}
        <Button asChild variant="outline" size="sm" className="max-sm:size-9 max-sm:px-0">
          <Link to={rankingsPagePath(locationId, "rankings/grid", { keyword: row.text })} aria-label="Open in Local Search Grid">
            <Grid3x3 aria-hidden /> <span className="max-sm:sr-only">Local Search Grid</span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="max-sm:size-9 max-sm:px-0">
          <Link to={rankingsPagePath(locationId, "rankings/map", { keyword: row.text })} aria-label="Open in Map Rankings">
            <MapIcon aria-hidden /> <span className="max-sm:sr-only">Map Rankings</span>
          </Link>
        </Button>
        {canEdit ? (
          <Button asChild variant="ai" size="sm" className="max-sm:h-9">
            <Link to={aiPostsPath(locationId, row.text)}>
              <PenLine aria-hidden /> Write a post with it
            </Link>
          </Button>
        ) : null}
        {canEdit ? (
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Move up in your order"
              title="Move up in your order"
              disabled={row.position === 0}
              onClick={() => actions.move(row, row.position - 1)}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Move down in your order"
              title="Move down in your order"
              disabled={row.position >= total - 1}
              onClick={() => actions.move(row, row.position + 1)}
            >
              <ArrowDown aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-critical hover:bg-critical-surface hover:text-critical max-sm:size-9 max-sm:px-0"
              disabled={total <= 1}
              aria-label="Stop tracking this keyword"
              title={total <= 1 ? "Keep at least one keyword." : "Stop tracking this keyword"}
              onClick={() => actions.remove(row)}
            >
              <Trash2 aria-hidden /> <span className="max-sm:sr-only">Stop tracking</span>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, tip, children }: { label: string; tip: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        <InfoTip label={`About ${label.toLowerCase()}`}>{tip}</InfoTip>
      </dt>
      <dd className="mt-1.5 flex min-h-7 items-center">{children}</dd>
    </div>
  );
}

function Section({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon aria-hidden className="size-4 text-muted-foreground" /> {title}
        </h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function UsageLine({ icon: Icon, tone, title, children }: { icon: LucideIcon; tone: string; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-strong">
        <Icon className={cn("size-4", tone)} />
      </span>
      <span className="min-w-0 text-sm">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="text-muted-foreground">{children}</span>
      </span>
    </li>
  );
}

/** Every tracked business for this keyword, best average first, you highlighted in place. */
function CompetitorBreakdown({
  entry,
  run,
  selfName,
  canEdit,
}: {
  entry: RankTrackerResponse["keywords"][number];
  run: RankTrackerResponse;
  selfName: string;
  canEdit: boolean;
}) {
  const statusText: RankStatusText | undefined = run.status_text;
  const name = (key: string, raw?: string | null) => targetLabel(key, selfName, raw);
  const targets = leaderboard(run.targets, (target) => entry.summary[target.key], (target) => name(target.key, target.name));
  return (
    <div className="space-y-3">
      <div className="relative overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead className="bg-surface-strong">
            <tr className="border-b border-border-strong text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2">Business</th>
              <th scope="col" className="px-3 py-2 text-right">Avg.</th>
              <th scope="col" className="px-3 py-2">Change</th>
              {POINTS.map((point) => (
                <th key={point} scope="col" className="px-1.5 py-2 text-center">
                  <span title={pointExplanation(point, run.run.config.tracker_offset_km)}>{point}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {targets.map((target, index) => {
              const summary = entry.summary[target.key];
              const you = target.key === "self";
              return (
                <tr key={target.key} className={cn(you && "bg-brand-tint/70 shadow-[inset_3px_0_0_var(--color-primary)]")}>
                  <td className="px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      <span className={cn("min-w-0 max-w-56 break-words", you ? "font-semibold text-foreground" : "text-foreground")}>{name(target.key, target.name)}</span>
                      {you ? (
                        <StatusBadge tone="brand" size="sm">
                          You
                        </StatusBadge>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <AvgRank value={summary?.avgRank} status={summary?.status} display={summary?.display} statusText={statusText} />
                  </td>
                  <td className="px-3 py-2.5">
                    <RankChange change={summary?.change} label={summary?.changeLabel} neutral={!you} />
                  </td>
                  {POINTS.map((point) => (
                    <td key={point} className="px-1.5 py-2.5 text-center">
                      <RankCellView cell={entry.cells.find((cell) => cell.point.label === point)?.byTarget[target.key]} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <BucketLegend />
      {run.targets.length <= 1 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock aria-hidden className="size-3.5" /> No competitors are tracked yet.{canEdit ? " Add some to see who ranks above you." : ""}
        </p>
      ) : null}
    </div>
  );
}
