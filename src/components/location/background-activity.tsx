import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Building2, FileText, LoaderCircle } from "lucide-react";
import { gbpReportKey } from "@/lib/gbp/use-gbp-report";
import { reviewsKey } from "@/lib/reviews/use-reviews";
import { hasBackgroundWork, rankingsKey, useRefreshState } from "@/lib/rankings/use-rankings";
import { cn } from "@/lib/utils";

/**
 * What runs in the background for a location (after setup, a refresh or the monthly
 * update): the ranking run, the Google data sync and the GBP report. Shows nothing
 * when all is idle; when a job finishes, the pages that use its data reload.
 */
export function BackgroundActivity({
  locationId,
  watch = false,
  className,
}: {
  locationId: string;
  /** Keep checking even before anything has started (right after setup). */
  watch?: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const state = useRefreshState(locationId, watch);
  const data = state.data;
  const busy = hasBackgroundWork(data);

  // When work finishes, refresh the pages that show its results.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) {
      void queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: gbpReportKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) });
    }
    wasBusy.current = busy;
  }, [busy, locationId, queryClient]);

  if (!data || !busy) return null;

  const items = [
    data.rankings.active_run
      ? {
          key: "rankings",
          icon: BarChart3,
          label: data.rankings.active_run.status === "queued" ? "Ranking run queued" : "Ranking run in progress",
          detail: "Searching Google Maps from every grid point. This can take a few minutes.",
          to: `/locations/${locationId}/rankings`,
        }
      : null,
    data.gbp?.active_sync || data.reviews?.in_progress
      ? {
          key: "gbp",
          icon: Building2,
          label: data.gbp?.active_sync ? "Syncing Google Business Profile data" : "Fetching reviews from Google",
          detail: data.reviews?.in_progress
            ? "Performance, search terms, profile, photos, posts and reviews. New reviews appear under Reputation when it finishes."
            : "Performance, search terms, profile, photos and posts.",
          to: data.gbp?.active_sync ? `/locations/${locationId}/gbp` : `/locations/${locationId}/reputation`,
        }
      : null,
    data.report?.pending
      ? {
          key: "report",
          icon: FileText,
          label: "Preparing the GBP report",
          detail: "The score, audit and competitor comparison update about 2 minutes after the sync or ranking run.",
          to: `/locations/${locationId}/gbp/audit`,
        }
      : null,
  ].filter((item) => item !== null);

  return (
    <section aria-label="Background activity" aria-live="polite" className={cn("rounded-lg border border-info/30 bg-info-surface/50 p-3", className)}>
      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex items-start gap-3">
              <span className="relative mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-surface text-info shadow-sm">
                <Icon aria-hidden className="size-4" />
                <LoaderCircle aria-hidden className="absolute -right-1 -top-1 size-3.5 animate-spin rounded-full bg-surface text-info" />
              </span>
              <span className="min-w-0 text-sm">
                <Link to={item.to} className="font-medium text-foreground hover:underline">{item.label}</Link>
                <span className="block text-xs text-muted-foreground">{item.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
