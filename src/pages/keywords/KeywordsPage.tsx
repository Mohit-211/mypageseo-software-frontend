import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock, Plus, Repeat, Rocket, Tags } from "lucide-react";
import type { KeywordGroup } from "@/api";
import { PageHeader, SectionHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { GroupDialog } from "@/components/keywords/group-dialog";
import { KeywordComposer } from "@/components/keywords/keyword-composer";
import { KeywordDetailSheet } from "@/components/keywords/keyword-detail-sheet";
import { KeywordGroupsSection } from "@/components/keywords/keyword-groups-section";
import { KeywordHealth } from "@/components/keywords/keyword-health";
import { KeywordUsageStrip } from "@/components/keywords/keyword-usage";
import { KeywordsTable, type KeywordRowActions } from "@/components/keywords/keywords-table";
import { SearchTermsSection } from "@/components/keywords/search-terms-section";
import { FirstRunProgress } from "@/components/ranking/first-run-progress";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useAiStatus } from "@/lib/ai/ai-status";
import { groupErrorText, useGroupMutations } from "@/lib/keywords/groups";
import { addKeywords, MAX_KEYWORDS, moveKeyword, quoteList, sameKeyword, withoutKeywords } from "@/lib/keywords/keywords";
import { filterKeywordRows, sortKeywordRows } from "@/lib/keywords/sort";
import { keywordErrorText, useKeywordRows, useSaveKeywords, type KeywordRow } from "@/lib/keywords/use-keywords";
import { useKeywordsParams } from "@/lib/keywords/use-keywords-params";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { formatRunDate } from "@/lib/rankings/format";
import { useRefreshRankings } from "@/lib/rankings/use-refresh-rankings";
import { cn } from "@/lib/utils";

/**
 * Keywords (`/locations/:locationId/keywords`): the searches this location wants to win. They are
 * an input to three modules, so they live here rather than under Rank Tracker: rank tracking
 * measures them, and AI posts and AI review replies use them (the saved order is the AI priority).
 *
 * One page, no tabs: header, health, add, the keyword table (row details in a sheet on `?keyword=`),
 * "Used by", groups (`#groups`) and Google search terms (`#searches`).
 */
function KeywordsPage() {
  const { location } = useLocationRoute();
  const locationId = location.location_id;
  const canEdit = useCanEdit();
  const params = useKeywordsParams();
  const data = useKeywordRows(locationId, { gbpConnected: location.gbp_connected });
  const saver = useSaveKeywords(locationId);
  const groupMutations = useGroupMutations(locationId);
  const refresh = useRefreshRankings(locationId);
  const ai = useAiStatus(locationId);
  const composerInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<KeywordRow | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [groupDialog, setGroupDialog] = useState<{ group: KeywordGroup | null; preset?: string[] } | null>(null);
  const routerLocation = useLocation();

  // The keyword sheet (`?keyword=`). While it slides closed it keeps showing what it showed: the last
  // keyword in the address (Back already removed it), or what was on screen when it was closed here
  // (`closing`, which also outlives a removed keyword). The address changes once it has closed.
  const [lastKeyword, setLastKeyword] = useState<string | null>(params.keyword);
  if (params.keyword !== null && params.keyword !== lastKeyword) setLastKeyword(params.keyword);
  const [closing, setClosing] = useState<{ key: string; keyword: string; row: KeywordRow | null } | null>(null);
  // Once the address has moved on, the close is done: Forward back onto the sheet's entry opens it again.
  if (closing !== null && closing.key !== routerLocation.key) setClosing(null);
  const closingNow = closing !== null && closing.key === routerLocation.key;

  const keywords = data.rows.map((row) => row.text);
  const setupRequired = location.status === "setup_required";
  const runAt = data.run?.run.run_at ?? data.tracking.data?.tracking.last_run_at ?? null;
  const previousRunAt = data.run?.trend.at(-2)?.run_at ?? null;
  const nextRun = refresh.nextAutomaticRun;
  const visible = sortKeywordRows(filterKeywordRows(data.rows, { q: query, groupId: params.group, band: params.band }), params.sort, params.order);
  const openRow = params.keyword ? (data.rows.find((row) => sameKeyword(row.text, params.keyword!)) ?? null) : null;
  const searchesMonth = data.searchTerms?.latest_month ?? null;
  const sheetKeyword = closingNow ? closing.keyword : (params.keyword ?? lastKeyword);
  const sheetRow = closingNow ? closing.row : sheetKeyword !== null ? (data.rows.find((row) => sameKeyword(row.text, sheetKeyword)) ?? null) : null;

  /** Slides the sheet closed with its content in place; `afterSheetClosed` then leaves its address. */
  const closeSheet = (row: KeywordRow | null = openRow) => {
    if (params.keyword !== null) setClosing({ key: routerLocation.key, keyword: params.keyword, row });
  };
  const afterSheetClosed = () => {
    // Only a close asked for on this entry: after Back the address is already right.
    if (closingNow) params.closeKeyword();
  };

  const focusComposer = () => {
    const input = composerInput.current;
    if (!input) return;
    input.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    input.focus({ preventScroll: true });
  };

  const showTable = () =>
    document.getElementById("keywords-table")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  /** After keywords were added: say when they're measured, and offer to measure them now. */
  const announceAdded = (added: string[]) => {
    const offerRefresh = canEdit && refresh.canStart && refresh.cost != null;
    toast.success(added.length === 1 ? `“${added[0]}” is now tracked` : `Added ${added.length} keywords`, {
      description: `${added.length === 1 ? "It's" : "They're"} measured from the next ranking run${nextRun ? ` (${formatRunDate(nextRun)})` : ""}.${
        offerRefresh ? ` Refreshing now costs ${refresh.cost} token${refresh.cost === 1 ? "" : "s"}.` : ""
      }`,
      ...(offerRefresh ? { action: { label: "Refresh now", onClick: () => void refresh.start() } } : {}),
    });
  };

  const addFromComposer = async (next: string[], added: string[]) => {
    await saver.save(next);
    announceAdded(added);
  };

  /** Track one keyword (a Google search term, or an old link to an untracked keyword). */
  const track = async (keyword: string) => {
    const result = addKeywords(keywords, keyword);
    if (result.added.length === 0) {
      toast.info(result.message ?? `“${keyword}” is already tracked.`);
      return;
    }
    try {
      await saver.save(result.keywords);
      announceAdded(result.added);
    } catch (err) {
      toast.error("The keyword couldn't be added", { description: keywordErrorText(err).message });
    }
  };

  const actions: KeywordRowActions = {
    open: (row) => params.openKeyword(row.text),
    move: (row, to) => {
      if (to === row.position || busyKey) return;
      setBusyKey(row.key);
      saver
        .save(moveKeyword(keywords, row.position, to))
        .then(() =>
          toast.success(`“${row.text}” is now #${to + 1}`, {
            description: to < 2 ? "Write with AI uses it by default." : to < 8 ? "AI reply drafts are offered it." : "Rank tracking still measures it in every run.",
          }),
        )
        .catch((err: unknown) => toast.error("The order couldn't be saved", { description: keywordErrorText(err).message }))
        .finally(() => setBusyKey(null));
    },
    remove: (row) => setRemoving(row),
    addToGroup: (row, group) => {
      groupMutations
        .addKeyword(group, row.text)
        .then(() => toast.success(`Added to “${group.name}”`))
        .catch((err: unknown) => toast.error(groupErrorText(err)));
    },
    newGroup: (row) => setGroupDialog({ group: null, preset: [row.text] }),
  };

  const confirmRemove = async () => {
    const row = removing;
    if (!row) return;
    try {
      await saver.save(withoutKeywords(keywords, [row.text]));
      setRemoving(null);
      // Its sheet slides closed still showing it (the row is gone from the list by then).
      if (openRow && sameKeyword(openRow.text, row.text)) closeSheet(openRow);
      toast.success(`Stopped tracking “${row.text}”`, { description: "Past runs and reports keep it. Nothing was charged." });
    } catch (err) {
      setRemoving(null);
      toast.error("The keyword couldn't be removed", { description: keywordErrorText(err).message });
    }
  };

  const header = (
    <PageHeader
      icon={Tags}
      tone="keywords"
      title="Keywords"
      description="The searches you want customers to find you for. Rank tracking measures them, and AI uses them in your Google posts and review replies."
      meta={
        data.tracking.isSuccess ? (
          <HeaderMeta count={keywords.length} lastRunAt={runAt} nextRunAt={nextRun} manualOnly={refresh.ready && !nextRun} />
        ) : undefined
      }
      actions={
        canEdit && data.tracking.isSuccess ? (
          <Button onClick={focusComposer} disabled={keywords.length >= MAX_KEYWORDS} title={keywords.length >= MAX_KEYWORDS ? `You track the maximum of ${MAX_KEYWORDS} keywords.` : undefined}>
            <Plus aria-hidden /> Add keywords
          </Button>
        ) : undefined
      }
    />
  );

  if (data.tracking.isPending) {
    return (
      <>
        {header}
        <PageSkeleton header={false} metrics={3} rows={8} columns={7} />
      </>
    );
  }
  if (data.tracking.isError) {
    return (
      <>
        {header}
        <ErrorState description="This location's keywords couldn't be loaded." onRetry={() => void data.tracking.refetch()} />
      </>
    );
  }

  const empty = keywords.length === 0;

  return (
    <>
      {header}

      {setupRequired ? (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/35 bg-warning-surface px-4 py-3 sm:flex-row sm:items-center">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-foreground">
            <Rocket aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              <span className="font-semibold">Setup isn't finished.</span> Keywords are measured once setup is complete and the first ranking run has run.
            </span>
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to={locationSetupPath(locationId)}>Continue setup</Link>
          </Button>
        </div>
      ) : null}

      {data.trackerState === "no_run" && !setupRequired ? <FirstRunProgress locationId={locationId} /> : null}

      {!empty ? (
        <KeywordHealth
          rows={data.rows}
          trackerState={data.trackerState}
          runAt={data.run?.run.run_at ?? null}
          previousRunAt={previousRunAt}
          refresh={refresh}
          canEdit={canEdit}
          band={params.band}
          onBand={(band) => {
            params.setBand(band);
            if (band) showTable();
          }}
          onRetry={() => void data.tracker.refetch()}
        />
      ) : null}

      {canEdit ? (
        <section aria-labelledby="add-keywords-title" className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
          {/* The count lives in the page header (one place), not here or above the table. */}
          <div className="mb-4 flex min-w-0 items-start gap-3">
            <IconChip icon={Plus} tone="keywords" size="md" />
            <div className="min-w-0">
              <h2 id="add-keywords-title" className="text-[15px] font-semibold leading-6 text-foreground">
                {empty ? "Add your first keywords" : "Add keywords"}
              </h2>
              <p className="text-[13px] text-muted-foreground">Adding keywords is free. They're measured from the next ranking run.</p>
            </div>
          </div>
          <KeywordComposer
            locationId={locationId}
            keywords={keywords}
            onAdd={addFromComposer}
            searchTerms={data.searchTerms?.top ?? null}
            autoSuggest={empty}
            inputRef={composerInput}
          />
        </section>
      ) : null}

      <section id="keywords-table" aria-label="Tracked keywords" className="scroll-mt-20">
        <SectionHeader
          icon={Tags}
          tone="keywords"
          title="Tracked keywords"
          description={empty ? "Nothing tracked yet." : "In your order: the order AI uses them in. Select a keyword for its full picture."}
        />
        <KeywordsTable
          locationId={locationId}
          rows={visible}
          total={keywords.length}
          trackerState={data.trackerState}
          statusText={data.run?.status_text}
          canEdit={canEdit}
          groups={data.groupList}
          groupId={params.group}
          onGroup={params.setGroup}
          band={params.band}
          onBand={params.setBand}
          query={query}
          onQuery={setQuery}
          sort={params.sort}
          order={params.order}
          onSort={params.onSort}
          onSortChange={params.setSort}
          onClearFilters={() => {
            setQuery("");
            params.clearFilters();
          }}
          actions={actions}
          searchesMonth={searchesMonth}
          busyKey={busyKey}
          emptyState={
            <EmptyState
              icon={Tags}
              tone="keywords"
              title={canEdit ? "Add the searches you want to win" : "No keywords yet"}
              description={
                canEdit
                  ? "Pick the local searches customers use to find a business like yours, for example “emergency dentist”. They're measured on Google Maps, and AI uses them in your posts and replies."
                  : "Someone with edit access can add them."
              }
              action={
                canEdit ? (
                  <Button onClick={focusComposer}>
                    <Plus aria-hidden /> Add keywords
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </section>

      {/* Secondary: what the keywords feed, after the list itself (page pattern: primary content first). */}
      <KeywordUsageStrip
        locationId={locationId}
        keywords={keywords}
        gridSize={data.tracking.data?.tracking.grid.size ?? null}
        ai={ai}
        gbpConnected={location.gbp_connected}
        setupRequired={setupRequired}
        rankingActive={refresh.active}
        nextAutomaticRun={nextRun}
      />

      <KeywordGroupsSection
        locationId={locationId}
        groups={data.groupList}
        limit={data.groupLimit}
        loading={data.groups.isPending}
        error={data.groups.isError}
        onRetry={() => void data.groups.refetch()}
        summaries={data.run?.groups ?? []}
        statusText={data.run?.status_text}
        tracked={keywords}
        canEdit={canEdit}
        onNew={() => setGroupDialog({ group: null })}
        onEdit={(group) => setGroupDialog({ group })}
        onShowInList={(group) => {
          params.setGroup(group.group_id);
          showTable();
        }}
      />

      <SearchTermsSection
        gbpConnected={location.gbp_connected}
        state={data.report.isPending ? "loading" : data.report.isError ? "error" : data.searchTerms ? "ready" : "none"}
        terms={data.searchTerms}
        keywords={keywords}
        canEdit={canEdit}
        onTrack={(term) => track(term.keyword)}
      />

      <KeywordDetailSheet
        locationId={locationId}
        open={params.keyword !== null && !closingNow}
        keyword={sheetKeyword}
        row={sheetRow}
        total={keywords.length}
        run={data.run}
        trackerState={data.trackerState}
        selfName={location.name}
        canEdit={canEdit}
        groups={data.groupList}
        searchesMonth={searchesMonth}
        nextRunAt={nextRun}
        actions={actions}
        onTrack={(keyword) => void track(keyword)}
        onClose={() => closeSheet()}
        onClosed={afterSheetClosed}
      />

      {groupDialog ? (
        <GroupDialog
          locationId={locationId}
          group={groupDialog.group}
          {...(groupDialog.preset ? { preset: groupDialog.preset } : {})}
          tracked={keywords}
          onClose={() => setGroupDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open || saver.saving ? undefined : setRemoving(null))}
        title={`Stop tracking “${removing?.text ?? ""}”?`}
        description={removing ? removalText(removing) : ""}
        confirmLabel="Stop tracking"
        pending={saver.saving}
        onConfirm={() => void confirmRemove()}
      />
    </>
  );
}

/** What removing a keyword does, in the words the confirm dialog uses. */
function removalText(row: KeywordRow): string {
  const groups = row.groups.map((group) => group.name);
  const leaves = groups.length ? ` and it leaves ${groups.length === 1 ? "the group" : `${groups.length} groups:`} ${quoteList(groups)}` : "";
  return `It's no longer measured from the next ranking run${leaves}. Past runs and reports keep it, but its history chart won't be available. AI posts and replies stop using it. Nothing is charged or refunded.`;
}

/** "12 of 20 keywords" with a small meter. */
function KeywordMeter({ count }: { count: number }) {
  const ratio = Math.min(1, count / MAX_KEYWORDS);
  const full = count >= MAX_KEYWORDS;
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-foreground" title={`${count} of ${MAX_KEYWORDS} keywords used`}>
      <span className="tabular-nums">
        {count} of {MAX_KEYWORDS}
        <span className="text-muted-foreground"> keywords</span>
      </span>
      <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", full ? "bg-warning" : "bg-chart-3")} style={{ width: `${ratio * 100}%` }} />
      </span>
    </div>
  );
}

function HeaderMeta({
  count,
  lastRunAt,
  nextRunAt,
  manualOnly,
}: {
  count: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  manualOnly: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <KeywordMeter count={count} />
      <span className="inline-flex items-center gap-1.5">
        <CalendarClock aria-hidden className="size-3.5" />
        {lastRunAt ? `Last measured ${formatRunDate(lastRunAt)}` : "Not measured yet"}
      </span>
      {nextRunAt ? (
        <span className="inline-flex items-center gap-1.5">
          <Repeat aria-hidden className="size-3.5" />
          Next automatic run {formatRunDate(nextRunAt)}
        </span>
      ) : manualOnly ? (
        <span className="inline-flex items-center gap-1.5">
          <Repeat aria-hidden className="size-3.5" />
          Automatic runs are off
        </span>
      ) : null}
    </div>
  );
}

export default KeywordsPage;
