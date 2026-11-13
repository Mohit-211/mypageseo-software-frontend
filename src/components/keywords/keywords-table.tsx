import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  Check,
  FolderPlus,
  FolderTree,
  Grid3x3,
  Map as MapIcon,
  PanelRightOpen,
  PenLine,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { KeywordGroup, RankStatusText } from "@/api";
import { AvgRankPill, RankChange } from "@/components/ranking/rank-ui";
import { InfoTip } from "@/components/layout/shared/info-tip";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { RowActions, SortableTh, TableScroll, Th, thClass } from "@/components/layout/shared/data-table";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BAND_LABEL, BAND_PILL, type KeywordBand } from "@/lib/keywords/bands";
import { groupHas } from "@/lib/keywords/groups";
import { KEYWORD_SORT_KEYS, aiPostsPath, rankingsPagePath, type KeywordSortKey } from "@/lib/keywords/paths";
import { searchCountText } from "@/lib/keywords/search-terms";
import { KEYWORD_SORT_LABEL } from "@/lib/keywords/sort";
import { USAGE_COPY, usageLabels } from "@/lib/keywords/usage-rules";
import type { KeywordRow, SearchTerm, TrackerState } from "@/lib/keywords/use-keywords";
import { formatMonth } from "@/lib/datetime";
import { formatRate } from "@/lib/rankings/format";
import type { SortDirection } from "@/lib/sort";
import { cn } from "@/lib/utils";

export type KeywordRowActions = {
  open: (row: KeywordRow) => void;
  /** Moves the keyword to a new place in the saved list (0 = first). */
  move: (row: KeywordRow, to: number) => void;
  remove: (row: KeywordRow) => void;
  addToGroup: (row: KeywordRow, group: KeywordGroup) => void;
  newGroup: (row: KeywordRow) => void;
};

/** "504", "Fewer than 15" (the wording of every search-terms screen), or null. */
function searchesText(term: SearchTerm | null): string | null {
  if (!term || (term.value == null && term.threshold == null)) return null;
  return searchCountText(term);
}

/**
 * The tracked keywords: one row each with its rank, movement, top-3 rate, Google searches, groups
 * and what AI uses it for, plus a row menu (details, order, groups, ranking pages, write a post,
 * remove). A table from `md` up (scrolling inside its card when narrow), cards on phones.
 */
export function KeywordsTable({
  locationId,
  rows,
  total,
  trackerState,
  statusText,
  canEdit,
  groups,
  groupId,
  onGroup,
  band,
  onBand,
  query,
  onQuery,
  sort,
  order,
  onSort,
  onSortChange,
  onClearFilters,
  actions,
  searchesMonth,
  busyKey,
  emptyState,
}: {
  locationId: string;
  /** The rows to show (filtered and sorted). */
  rows: readonly KeywordRow[];
  /** Every tracked keyword (for counts). */
  total: number;
  trackerState: TrackerState;
  statusText?: RankStatusText | undefined;
  canEdit: boolean;
  groups: readonly KeywordGroup[];
  groupId: string | null;
  onGroup: (groupId: string | null) => void;
  band: KeywordBand | null;
  onBand: (band: KeywordBand | null) => void;
  query: string;
  onQuery: (query: string) => void;
  sort: KeywordSortKey;
  order: SortDirection;
  onSort: (sort: KeywordSortKey) => void;
  onSortChange: (sort: KeywordSortKey) => void;
  onClearFilters: () => void;
  actions: KeywordRowActions;
  /** The month of the Google search counts ("2026-10"), for the column tip. */
  searchesMonth: string | null;
  /** The keyword being saved (its menu waits). */
  busyKey: string | null;
  /** Shown instead of the table when there are no keywords at all. */
  emptyState: ReactNode;
}) {
  const filtered = Boolean(query || groupId || band);
  const activeGroup = groups.find((group) => group.group_id === groupId) ?? null;

  if (total === 0) return <>{emptyState}</>;

  const sortable = (value: KeywordSortKey, label: string, align: "left" | "right" = "left", className?: string) => (
    <SortableTh label={label} value={value} active={sort} order={order} onSort={onSort} align={align} className={className} />
  );

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {/* Toolbar: search, groups, and (phones) the sort. */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-64">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            aria-label="Search keywords"
            placeholder="Search keywords"
            className="h-9 pl-9"
          />
        </div>
        {groups.length > 0 ? (
          <div role="group" aria-label="Filter by keyword group" className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <FilterChip active={!groupId} onClick={() => onGroup(null)} count={total}>
              All
            </FilterChip>
            {groups.map((group) => (
              <FilterChip key={group.group_id} active={group.group_id === groupId} onClick={() => onGroup(group.group_id === groupId ? null : group.group_id)} count={group.keywords.length}>
                {group.name}
              </FilterChip>
            ))}
          </div>
        ) : (
          <span className="hidden flex-1 lg:block" />
        )}
        <Select value={sort} onValueChange={(value) => onSortChange(value as KeywordSortKey)}>
          <SelectTrigger className="h-9 w-full md:hidden" aria-label="Sort keywords">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KEYWORD_SORT_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {KEYWORD_SORT_LABEL[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {band || activeGroup ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-strong px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Showing {rows.length} of {total}
          </span>
          {band ? (
            <ActiveChip label="Rank" value={BAND_LABEL[band]} onClear={() => onBand(null)} />
          ) : null}
          {activeGroup ? <ActiveChip label="Group" value={activeGroup.name} onClear={() => onGroup(null)} /> : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          variant="no-results"
          title="No keywords match"
          description={query ? `Nothing matches “${query}” with these filters.` : "No keyword is in this group or rank band."}
          action={
            filtered ? (
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Tablets and up: the table (it scrolls inside the card when narrow). */}
          <div className="hidden md:block">
            <TableScroll minWidth={980} label="Tracked keywords">
              <thead className="bg-surface-strong">
                <tr className="border-b border-border-strong">
                  {sortable("priority", "#", "left", "w-16")}
                  {sortable("keyword", "Keyword", "left", "min-w-56")}
                  {sortable("rank", "Avg. rank", "right", "whitespace-nowrap")}
                  {sortable("change", "Change", "left", "whitespace-nowrap")}
                  {sortable("top3", "Top 3", "right", "whitespace-nowrap")}
                  {sortable("searches", "Searches", "right", "whitespace-nowrap")}
                  <Th>Groups</Th>
                  <th scope="col" className={cn(thClass, "whitespace-nowrap")}>
                    <span className="inline-flex items-center gap-1">
                      Used by AI
                      <InfoTip label="About the AI order">{USAGE_COPY.columnTip}</InfoTip>
                    </span>
                  </th>
                  <Th srOnly>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className="cursor-pointer transition-colors hover:bg-accent/60"
                    onClick={(event) => {
                      // The row is a shortcut for the keyword's button. Its own buttons and links keep their
                      // clicks, and so does the row menu (a portal: React bubbles its clicks here too).
                      const target = event.target as Node;
                      if (!event.currentTarget.contains(target)) return;
                      if (target instanceof Element && target.closest("button, a, [role=menuitem]")) return;
                      actions.open(row);
                    }}
                  >
                    <td className="px-4 py-3 align-middle">
                      <PriorityBadge position={row.position} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <KeywordName row={row} showNew={trackerState === "ready"} onOpen={() => actions.open(row)} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <RankValue row={row} trackerState={trackerState} statusText={statusText} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {row.measured ? <RankChange change={row.self?.change} label={row.self?.changeLabel} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right align-middle text-sm tabular-nums text-foreground">{row.measured ? formatRate(row.self?.top3Rate) : "—"}</td>
                    <td
                      className="whitespace-nowrap px-4 py-3 text-right align-middle text-sm tabular-nums text-foreground"
                      title={row.searches && searchesMonth ? `Searches that found your profile in ${formatMonth(searchesMonth)}` : undefined}
                    >
                      {searchesText(row.searches) ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <GroupChips groups={row.groups} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <UsageBadges row={row} />
                    </td>
                    <td className="px-2 py-3 text-right align-middle">
                      <KeywordMenu locationId={locationId} row={row} total={total} canEdit={canEdit} groups={groups} actions={actions} busy={busyKey === row.key} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>
          </div>

          {/* Phones: one card per keyword. */}
          <ul className="divide-y divide-border md:hidden" aria-label="Tracked keywords">
            {rows.map((row) => (
              <li key={row.key} className="flex items-start gap-3 px-4 py-3.5">
                <PriorityBadge position={row.position} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <KeywordName row={row} showNew={trackerState === "ready"} onOpen={() => actions.open(row)} />
                    <RankValue row={row} trackerState={trackerState} statusText={statusText} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {row.measured ? <RankChange change={row.self?.change} label={row.self?.changeLabel} /> : null}
                    {row.measured ? <span>Top 3 {formatRate(row.self?.top3Rate)}</span> : null}
                    {searchesText(row.searches) ? <span>{searchesText(row.searches)} searches</span> : null}
                  </div>
                  {row.groups.length > 0 || usageLabels(row.use).length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.groups.length > 0 ? <GroupChips groups={row.groups} /> : null}
                      <UsageBadges row={row} />
                    </div>
                  ) : null}
                </div>
                <KeywordMenu locationId={locationId} row={row} total={total} canEdit={canEdit} groups={groups} actions={actions} busy={busyKey === row.key} />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="flex items-start gap-2 border-t border-border bg-surface-strong px-4 py-3 text-xs text-muted-foreground">
        <Sparkles aria-hidden className="mt-px size-3.5 shrink-0 text-ai" />
        <span>
          {USAGE_COPY.orderTip}
          {canEdit ? " Use a keyword's menu to move it." : ""}
        </span>
      </p>
    </div>
  );
}

function FilterChip({ active, onClick, count, children }: { active: boolean; onClick: () => void; count: number; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary bg-brand-tint text-foreground" : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
      <span className={cn("tabular-nums", active ? "font-semibold text-primary" : "text-muted-foreground")}>{count}</span>
    </button>
  );
}

function ActiveChip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-primary/20 bg-brand-tint py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary">
      {label}: <span className="text-foreground">{value}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear the ${label.toLowerCase()} filter`}
        className="relative grid size-5 cursor-pointer place-items-center rounded-full outline-hidden after:absolute after:-inset-1.5 after:content-[''] hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X aria-hidden className="size-3" />
      </button>
    </span>
  );
}

/** "#3": the keyword's place in the saved list, which is its AI priority. */
function PriorityBadge({ position }: { position: number }) {
  return (
    <span
      title={`#${position + 1} in your order`}
      className="inline-grid h-6 min-w-7 shrink-0 place-items-center rounded-md border border-border bg-surface-strong px-1.5 text-xs font-semibold tabular-nums text-muted-foreground"
    >
      <span className="sr-only">Priority </span>#{position + 1}
    </span>
  );
}

function KeywordName({ row, showNew, onOpen }: { row: KeywordRow; showNew: boolean; onOpen: () => void }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 cursor-pointer rounded-sm text-left text-sm font-semibold text-foreground underline-offset-2 outline-hidden hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        {row.text}
      </button>
      {/* "New" only next to a run that doesn't have it yet (before any run, every keyword waits). */}
      {showNew && !row.measured ? (
        <StatusBadge tone="info" size="sm">
          New
        </StatusBadge>
      ) : null}
    </span>
  );
}

function RankValue({ row, trackerState, statusText }: { row: KeywordRow; trackerState: TrackerState; statusText?: RankStatusText | undefined }) {
  if (trackerState === "loading") return <Skeleton className="ml-auto h-6 w-12" />;
  if (!row.measured) {
    return (
      <span
        title="Added after the last run. It's measured from the next ranking run."
        className={cn("inline-flex min-w-12 items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium", BAND_PILL.pending)}
      >
        {trackerState === "ready" ? "Next run" : "—"}
      </span>
    );
  }
  return <AvgRankPill value={row.self?.avgRank} status={row.self?.status} display={row.self?.display} statusText={statusText} />;
}

function GroupChips({ groups }: { groups: readonly KeywordGroup[] }) {
  if (groups.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = groups.slice(0, 2);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((group) => (
        <Badge key={group.group_id} variant="neutral" size="sm" className="max-w-40 truncate">
          {group.name}
        </Badge>
      ))}
      {groups.length > shown.length ? (
        <span className="text-xs text-muted-foreground" title={groups.slice(2).map((group) => group.name).join(", ")}>
          +{groups.length - shown.length}
        </span>
      ) : null}
    </span>
  );
}

function UsageBadges({ row }: { row: KeywordRow }) {
  const labels = usageLabels(row.use);
  if (labels.length === 0) {
    return (
      <span className="text-xs text-muted-foreground" title="Only rank tracking uses it. Move it into your first 8 for AI replies.">
        Rankings only
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      {labels.map((label) => (
        <Badge key={label} variant="ai" size="sm">
          {label}
        </Badge>
      ))}
    </span>
  );
}

function KeywordMenu({
  locationId,
  row,
  total,
  canEdit,
  groups,
  actions,
  busy,
}: {
  locationId: string;
  row: KeywordRow;
  total: number;
  canEdit: boolean;
  groups: readonly KeywordGroup[];
  actions: KeywordRowActions;
  busy: boolean;
}) {
  const first = row.position === 0;
  const last = row.position === total - 1;
  return (
    <RowActions label={`Actions for ${row.text}`} disabled={busy} contentClassName="w-60">
      <DropdownMenuItem onSelect={() => actions.open(row)}>
        <PanelRightOpen aria-hidden /> Open details
      </DropdownMenuItem>
      {canEdit ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>AI priority (#{row.position + 1})</DropdownMenuLabel>
          <DropdownMenuItem disabled={first} onSelect={() => actions.move(row, 0)}>
            <ArrowUpToLine aria-hidden /> Move to top
          </DropdownMenuItem>
          <DropdownMenuItem disabled={first} onSelect={() => actions.move(row, row.position - 1)}>
            <ArrowUp aria-hidden /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={last} onSelect={() => actions.move(row, row.position + 1)}>
            <ArrowDown aria-hidden /> Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderTree aria-hidden /> Add to group
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {groups.map((group) => {
                const member = groupHas(group, row.text);
                return (
                  <DropdownMenuItem key={group.group_id} disabled={member} onSelect={() => actions.addToGroup(row, group)}>
                    {member ? <Check aria-hidden /> : <span aria-hidden className="size-4" />}
                    <span className="truncate">{group.name}</span>
                  </DropdownMenuItem>
                );
              })}
              {groups.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onSelect={() => actions.newGroup(row)}>
                <FolderPlus aria-hidden /> New group…
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to={rankingsPagePath(locationId, "rankings/grid", { keyword: row.text })}>
          <Grid3x3 aria-hidden /> Open in Local Search Grid
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to={rankingsPagePath(locationId, "rankings/map", { keyword: row.text })}>
          <MapIcon aria-hidden /> Open in Map Rankings
        </Link>
      </DropdownMenuItem>
      {canEdit ? (
        <DropdownMenuItem asChild>
          <Link to={aiPostsPath(locationId, row.text)}>
            <PenLine aria-hidden /> Write a post with it
          </Link>
        </DropdownMenuItem>
      ) : null}
      {canEdit ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={total <= 1}
            className="text-critical focus:bg-critical-surface focus:text-critical [&>svg]:text-critical focus:[&>svg]:text-critical"
            onSelect={() => actions.remove(row)}
          >
            <Trash2 aria-hidden /> {total <= 1 ? "Keep at least one keyword" : "Stop tracking"}
          </DropdownMenuItem>
        </>
      ) : null}
    </RowActions>
  );
}
