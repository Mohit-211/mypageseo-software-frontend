import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/layout/shared/info-tip";
import { BAND_DESCRIPTION, BAND_FILL, BAND_LABEL, BAND_ORDER, summarizeHealth, type KeywordBand } from "@/lib/keywords/bands";
import type { KeywordRow, TrackerState } from "@/lib/keywords/use-keywords";
import { formatRunDate } from "@/lib/rankings/format";
import { refreshLabel, type RefreshRankings } from "@/lib/rankings/use-refresh-rankings";
import { cn } from "@/lib/utils";

/** The five rank bands always show (a zero says something too); "no data" and "next run" only when they occur. */
const ALWAYS: ReadonlySet<KeywordBand> = new Set(["pack", "visible", "low", "invisible", "not_found"]);

/**
 * Keyword health: how the keywords rank in the latest run, as one stacked bar in the rank colours,
 * the movement since the previous run, and a prompt when new keywords wait for the next run. The
 * legend filters the keyword table by band.
 */
export function KeywordHealth({
  rows,
  trackerState,
  runAt,
  previousRunAt,
  refresh,
  canEdit,
  band,
  onBand,
  onRetry,
}: {
  rows: readonly KeywordRow[];
  trackerState: TrackerState;
  runAt: string | null;
  previousRunAt: string | null;
  refresh: RefreshRankings;
  canEdit: boolean;
  /** The table's band filter. */
  band: KeywordBand | null;
  onBand: (band: KeywordBand | null) => void;
  onRetry: () => void;
}) {
  const health = summarizeHealth(rows);
  const pending = health.counts.pending;
  const bands = BAND_ORDER.filter((entry) => ALWAYS.has(entry) || health.counts[entry] > 0);
  const summary = bands.map((entry) => `${BAND_LABEL[entry]}: ${health.counts[entry]}`).join(", ");

  return (
    <section aria-labelledby="keyword-health-title" className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 id="keyword-health-title" className="flex items-center gap-1.5 text-[15px] font-semibold leading-6 text-foreground">
            Keyword health
            <InfoTip label="About keyword health">
              Each keyword's average Google Maps position for your business in the latest ranking run, from 5 search spots. Pick a band to see its keywords.
            </InfoTip>
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {trackerState === "ready" && runAt
              ? `${health.total} keyword${health.total === 1 ? "" : "s"}, ranked in the run of ${formatRunDate(runAt)}.`
              : trackerState === "no_run"
                ? "Ranks appear here after the first ranking run."
                : trackerState === "error"
                  ? "Ranks couldn't be loaded right now."
                  : "Loading the latest ranks…"}
          </p>
        </div>
        {trackerState === "ready" && health.measured > 0 ? <MovementChips movement={health.movement} previousRunAt={previousRunAt} /> : null}
      </div>

      {trackerState === "loading" ? (
        <div role="status" aria-label="Loading ranks" className="mt-4 space-y-3">
          <Skeleton className="h-3.5 w-full rounded-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : trackerState === "error" ? (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlert aria-hidden className="size-4 text-warning" /> Your keywords are listed below; their ranks will show once this loads.
          <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Keywords by average rank. ${summary}.`}
            className="mt-4 flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
          >
            {health.total > 0
              ? BAND_ORDER.filter((entry) => health.counts[entry] > 0).map((entry) => (
                  <span
                    key={entry}
                    title={`${BAND_LABEL[entry]}: ${health.counts[entry]}`}
                    className={cn("h-full transition-[width] duration-500 motion-reduce:transition-none", BAND_FILL[entry])}
                    style={{ width: `${(health.counts[entry] / health.total) * 100}%` }}
                  />
                ))
              : null}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-1.5 gap-y-1.5" aria-label="Filter keywords by rank band">
            {bands.map((entry) => {
              const count = health.counts[entry];
              const active = band === entry;
              return (
                <li key={entry}>
                  <button
                    type="button"
                    aria-pressed={active}
                    disabled={count === 0 && !active}
                    title={BAND_DESCRIPTION[entry]}
                    onClick={() => onBand(active ? null : entry)}
                    className={cn(
                      "inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                      active
                        ? "border-primary bg-brand-tint text-foreground"
                        : count === 0
                          ? "border-transparent text-muted-foreground"
                          : "border-border bg-card text-foreground hover:border-border-strong hover:bg-accent",
                    )}
                  >
                    <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", BAND_FILL[entry], entry === "pending" && "ring-1 ring-info/50")} />
                    {BAND_LABEL[entry]}
                    <span className={cn("tabular-nums", count === 0 ? "text-muted-foreground" : "font-semibold")}>{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {pending > 0 && trackerState !== "loading" ? (
        <NewKeywordsPrompt count={pending} refresh={refresh} canEdit={canEdit} firstRun={trackerState === "no_run"} />
      ) : null}
    </section>
  );
}

function MovementChips({ movement, previousRunAt }: { movement: Record<"improved" | "declined" | "unchanged" | "new", number>; previousRunAt: string | null }) {
  const items = [
    { key: "improved", count: movement.improved, label: "improved", icon: ArrowUpRight, tone: "border-success/25 bg-success-surface text-success" },
    // Amber, not red: a keyword slipping needs attention, it isn't an alarm.
    { key: "declined", count: movement.declined, label: "declined", icon: ArrowDownRight, tone: "border-warning/35 bg-warning-surface text-warning-foreground" },
    { key: "unchanged", count: movement.unchanged, label: "unchanged", icon: ArrowRight, tone: "" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <span
            key={item.key}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold tabular-nums",
              // A zero is neutral, never red or green.
              item.count > 0 && item.tone ? item.tone : "border-border-strong/70 bg-muted text-muted-foreground",
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {item.count} {item.label}
          </span>
        );
      })}
      {previousRunAt ? <span className="text-muted-foreground">since {formatRunDate(previousRunAt)}</span> : null}
    </div>
  );
}

function NewKeywordsPrompt({ count, refresh, canEdit, firstRun }: { count: number; refresh: RefreshRankings; canEdit: boolean; firstRun: boolean }) {
  const when = refresh.nextAutomaticRun ? ` (${formatRunDate(refresh.nextAutomaticRun)})` : "";
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-info/25 bg-info-surface px-3.5 py-3 sm:flex-row sm:items-center">
      <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-foreground">
        {refresh.active ? (
          <LoaderCircle aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-info" />
        ) : (
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
        )}
        <span>
          {refresh.active ? (
            <>
              <span className="font-semibold">Measuring now.</span> {count === 1 ? "Your new keyword's" : `Your ${count} new keywords'`} ranks show up when the run finishes.
            </>
          ) : (
            <>
              <span className="font-semibold">
                {count} {firstRun ? (count === 1 ? "keyword waits" : "keywords wait") : count === 1 ? "new keyword waits" : "new keywords wait"} for the next run
              </span>
              {when}.{" "}
              {canEdit ? "Refresh now to measure them today, or let the free automatic run pick them up." : "The automatic run measures them."}
            </>
          )}
        </span>
      </p>
      {canEdit && !refresh.active ? (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!refresh.canStart}
          aria-busy={refresh.starting || undefined}
          // Why it can't start when the account is read-only or suspended (as on the Rankings header).
          title={refresh.blockedReason ?? undefined}
          onClick={() => void refresh.start()}
        >
          {refresh.starting ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
          {refreshLabel(refresh, "Refresh now")}
        </Button>
      ) : null}
    </div>
  );
}
