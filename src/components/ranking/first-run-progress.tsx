import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, FileBarChart, LoaderCircle, RotateCw } from "lucide-react";
import { apiErrorData, isApiError, refreshLocation } from "@/api";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { formatTime } from "@/lib/datetime";
import { REPORT_DELAY_MS, useFirstData, useFirstRunCard, type FirstDataState } from "@/lib/rankings/first-data";
import { rankingsKey } from "@/lib/rankings/use-rankings";
import { cn } from "@/lib/utils";

/**
 * A new location's wait for its first data (Mohit, 2026-10-12): the first ranking run's
 * progress, and on the GBP report page the report that follows it. Shows `fallback` when
 * nothing is running, pending or failed, so the caller keeps its usual empty state.
 */
export function FirstRunProgress({
  locationId,
  runId,
  for: page = "rankings",
  fallback = null,
  className,
}: {
  locationId: string;
  /** The run started by the Finish step (`POST onboarding/complete` → `rank_run.run_id`). */
  runId?: string | null | undefined;
  for?: "rankings" | "gbp-report";
  /** Shown when nothing is running, pending or failed. */
  fallback?: React.ReactNode;
  className?: string;
}) {
  const now = useNow(15_000);
  const state = useFirstData(locationId, now, runId);
  // The card replaces the activity banner's run / report lines.
  useFirstRunCard(locationId, !state.isPending && (state.active || state.failed || (page === "gbp-report" && state.reportPending)));

  if (state.isPending) {
    return (
      <Frame className={className}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden className="size-4 animate-spin" /> Checking this location's first data…
        </p>
      </Frame>
    );
  }
  if (state.failed && !state.active) return <FailedRun locationId={locationId} className={className} />;
  if (state.active) {
    return (
      <Frame className={className}>
        <RunProgress state={state} />
        {page === "gbp-report" ? (
          <p className="mt-3 flex items-start gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
            <FileBarChart aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Your GBP report is built when the first ranking run finishes, about 2 minutes after ready time
              {state.readyAt ? ` (around ${formatTime(new Date(state.readyAt.getTime() + REPORT_DELAY_MS))})` : ""}.
            </span>
          </p>
        ) : null}
      </Frame>
    );
  }
  if (page === "gbp-report" && state.reportPending) {
    const at = state.refresh?.report?.scheduled_for;
    return (
      <Frame className={className}>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LoaderCircle aria-hidden className="size-4 animate-spin text-primary" /> Building your GBP report…
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {at ? `It should be ready around ${formatTime(at)}.` : "It should be ready in a couple of minutes."} This page updates on its own.
        </p>
      </Frame>
    );
  }
  return <>{fallback}</>;
}

/** The run's line, bar and timing. */
function RunProgress({ state }: { state: FirstDataState }) {
  const run = state.run;
  const keywords = run?.estimate?.keywords;
  const grid = run?.estimate?.gridSize;
  const started = run ? (run.started_at ?? run.run_at) : null;
  const scope = [keywords ? `${keywords} keyword${keywords === 1 ? "" : "s"}` : null, grid ? `across a ${grid}×${grid} grid` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div role="status" aria-live="polite" className="space-y-2.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Clock aria-hidden className="size-4 text-primary" />
        Your first ranking run is {run?.status === "queued" ? "about to start" : "in progress"}{scope ? `: ${scope}` : ""}.
      </p>
      <p className="text-sm text-muted-foreground">
        {started ? `${run?.started_at ? "Started" : "Starting"} ${formatTime(started)}` : "Starting soon"}
        {state.readyAt && !state.overdue
          ? `, ready around ${formatTime(state.readyAt)}${state.minutesLeft !== null ? ` (about ${Math.max(1, state.minutesLeft)} minute${Math.max(1, state.minutesLeft) === 1 ? "" : "s"} left)` : ""}`
          : ""}
        .
      </p>
      {state.progress !== null ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="First ranking run"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state.progress * 100)}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(3, state.progress * 100)}%` }} />
        </div>
      ) : null}
      {state.overdue ? (
        <p className="text-sm text-muted-foreground">Taking a bit longer than usual. Large grids can take a few extra minutes.</p>
      ) : (
        <p className="text-xs text-muted-foreground">You can leave this page; it updates on its own.</p>
      )}
    </div>
  );
}

function FailedRun({ locationId, className }: { locationId: string; className?: string | undefined }) {
  const canEdit = useCanEdit();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const runAgain = async () => {
    setBusy(true);
    try {
      await refreshLocation(locationId, ["rankings"]);
      await queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      toast.success("A new ranking run has started.");
    } catch (err) {
      const reason = isApiError(err) ? err.reason : undefined;
      if (reason === "insufficient_tokens") {
        toast.error(`Not enough tokens: this costs ${String(apiErrorData(err).cost ?? "?")}.`, {
          action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") },
        });
      } else {
        toast.error(isApiError(err) && err.status === 429 ? "A run was started a moment ago. Try again later." : "The run couldn't be started. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame className={className}>
      <p className="text-sm font-semibold text-foreground">The first ranking run didn't finish.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Nothing was charged. {canEdit ? "Run it again now, or wait for the next monthly refresh." : "It runs again with the next monthly refresh."}
      </p>
      {canEdit ? (
        <Button size="sm" className="mt-3" disabled={busy} onClick={() => void runAgain()}>
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <RotateCw aria-hidden />} Run again
        </Button>
      ) : null}
    </Frame>
  );
}

function Frame({ className, children }: { className?: string | undefined; children: React.ReactNode }) {
  return <div className={cn("rounded-lg border border-border bg-surface p-5 shadow-card", className)}>{children}</div>;
}
