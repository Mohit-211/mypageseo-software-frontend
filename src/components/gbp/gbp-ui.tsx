import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, LoaderCircle, RefreshCw } from "lucide-react";
import { apiErrorData, isApiError, refreshLocation, type CheckState, type GbpUnavailable } from "@/api";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { GbpNavigation, type GbpView } from "@/components/location/location-workspace";
import { Button } from "@/components/ui/button";
import { STATE_LABEL, STATE_TONE, unavailableCopy } from "@/lib/gbp/gbp-labels";
import { gbpReportKey, isNoReportYet } from "@/lib/gbp/use-gbp-report";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { formatRunDate } from "@/lib/rankings/format";
import { rankingsKey, useRefreshState } from "@/lib/rankings/use-rankings";

export function StateBadge({ state }: { state: CheckState }) {
  return <StatusBadge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</StatusBadge>;
}

/** A section the report can't show, with copy by `reason`. */
export function SectionUnavailable({ section, compact = false }: { section: GbpUnavailable; compact?: boolean }) {
  const copy = unavailableCopy(section.reason);
  if (compact) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span><span className="font-medium text-foreground">{copy.title}.</span> {copy.description}</span>
      </p>
    );
  }
  return <EmptyState title={copy.title} description={copy.description} className="min-h-40" />;
}

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Manual GBP refresh: a sync now (tokens, once per 24 h); the report regenerates ~2 min after it. */
export function RefreshGbpButton({ locationId, gbpConnected }: { locationId: string; gbpConnected: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const state = useRefreshState(locationId);
  const now = useNow();
  const gbp = state.data?.gbp ?? null;
  const active = gbp?.active_sync ?? null;
  const nextAllowed = gbp?.next_allowed_at ?? null;
  const waiting = nextAllowed !== null && new Date(nextAllowed).getTime() > now;
  const cost = state.data?.tokens.cost.gbp;

  if (!gbpConnected) return null;

  const run = async () => {
    try {
      const result = await refreshLocation(locationId, ["gbp"]);
      const gbpResult = result.gbp;
      if (gbpResult && "skipped" in gbpResult) {
        toast.message(`Google data can be refreshed again ${formatRunDate(gbpResult.next_allowed_at, true)}.`);
      } else {
        toast.success(gbpResult?.existing ? "A Google sync is already running." : "Fetching the latest Google data. The report updates a couple of minutes after it finishes.");
      }
    } catch (err) {
      if (isApiError(err) && err.reason === "insufficient_tokens") {
        const data = apiErrorData(err);
        toast.error(`Not enough tokens: this refresh costs ${String(data.cost ?? cost ?? "?")}, your balance is ${String(data.balance ?? "?")}.`, {
          action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") },
        });
      } else if (isApiError(err) && err.reason === "read_only") {
        toast.error("Your access is read-only, so you can't start a refresh.");
      } else if (isApiError(err) && err.status === 429) {
        const next = (apiErrorData(err).gbp as { next_allowed_at?: string } | undefined)?.next_allowed_at;
        toast.error(`Google data was refreshed recently. Try again ${next ? formatRunDate(next, true) : "in 24 hours"}.`);
      } else {
        toast.error(isApiError(err) && err.message ? err.message : "The refresh couldn't be started. Try again.");
      }
    } finally {
      void queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: gbpReportKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: ["billing", "tokens"] });
    }
  };

  const label = active
    ? "Syncing Google data…"
    : waiting
      ? `Next refresh ${formatRunDate(nextAllowed, true)}`
      : `Refresh GBP${cost != null ? ` (${cost} token${cost === 1 ? "" : "s"})` : ""}`;

  return (
    <Button variant="outline" size="sm" disabled={!state.data || Boolean(active) || waiting} onClick={() => void run()}>
      {active ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
      {label}
    </Button>
  );
}

/** Sub-tabs, title, freshness and the refresh button shared by the GBP pages. */
export function GbpPageHeader({
  locationId,
  view,
  title,
  description,
  generatedAt,
  pending,
  gbpConnected,
  actions,
}: {
  locationId: string;
  view: GbpView;
  title: string;
  description: string;
  generatedAt?: string | null | undefined;
  pending?: boolean | undefined;
  gbpConnected: boolean;
  actions?: ReactNode;
}) {
  return (
    <>
      <GbpNavigation locationId={locationId} activeView={view} />
      <PageHeader
        title={title}
        description={description}
        meta={
          generatedAt || pending ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {pending ? <LoaderCircle aria-hidden className="size-3 animate-spin" /> : null}
              {generatedAt ? `Report updated ${formatRunDate(generatedAt, true)}` : ""}
              {pending ? `${generatedAt ? " · " : ""}a new version is being prepared` : ""}
            </p>
          ) : undefined
        }
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <RefreshGbpButton locationId={locationId} gbpConnected={gbpConnected} />
            {actions}
          </div>
        }
      />
    </>
  );
}

/** Loading / no report yet / error states shared by the GBP pages. */
export function GbpReportError({ error, onRetry, gbpConnected }: { error: unknown; onRetry: () => void; gbpConnected: boolean }) {
  const { connect } = useGbpConnect();
  if (isNoReportYet(error)) {
    return (
      <EmptyState
        title="No GBP report yet"
        description={
          gbpConnected
            ? "The report is made after the first Google sync or ranking run. It usually appears within minutes of setup; use Refresh GBP to sync now."
            : "Connect this location's Google Business Profile to get its report. The public competitor comparison appears after the first ranking run."
        }
        action={gbpConnected ? undefined : <Button size="sm" onClick={() => connect()}>Connect Google</Button>}
      />
    );
  }
  if (isApiError(error) && error.status === 404) {
    return (
      <EmptyState
        title="Location not found"
        description="It may have been deleted."
        action={<Button asChild variant="outline"><Link to="/locations"><ArrowLeft aria-hidden /> Back to locations</Link></Button>}
      />
    );
  }
  return <ErrorState description="The GBP report couldn't be loaded." onRetry={onRetry} />;
}
