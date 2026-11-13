import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Building2, FileText, LoaderCircle } from "lucide-react";
import { gbpReportKey } from "@/lib/gbp/use-gbp-report";
import { LOCATIONS_QUERY_KEY } from "@/lib/locations/use-locations";
import { locationPath } from "@/lib/mypageseo/section-links";
import { reviewsKey } from "@/lib/reviews/use-reviews";
import { hasBackgroundWork, rankingsKey, useRefreshState } from "@/lib/rankings/use-rankings";
import { useFirstRunCardShown } from "@/lib/rankings/first-data";
import { cn } from "@/lib/utils";

/**
 * What runs in the background for a location (after setup, a refresh or the monthly
 * update): the ranking check, the Google data sync and the profile report. Shows nothing
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
  // A first-run card on the page already shows the run and the report.
  const firstRunCard = useFirstRunCardShown(locationId);

  // When work finishes, refresh the pages that show its results (the overview included).
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) {
      void queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: gbpReportKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: [...LOCATIONS_QUERY_KEY, "overview", locationId] });
    }
    wasBusy.current = busy;
  }, [busy, locationId, queryClient]);

  if (!data || !busy) return null;

  const items = [
    data.rankings.active_run
      ? {
          key: "rankings",
          icon: BarChart3,
          label: data.rankings.active_run.status === "queued" ? "Ranking check queued" : "Checking your rankings",
          detail: "Searching Google Maps from every point around the business. This takes a few minutes.",
          to: locationPath(locationId, "rankings"),
        }
      : null,
    data.gbp?.active_sync || data.reviews?.in_progress
      ? {
          key: "gbp",
          icon: Building2,
          label: data.gbp?.active_sync ? "Syncing your Google Business Profile" : "Fetching reviews from Google",
          detail: data.reviews?.in_progress
            ? "Performance, searches, profile, photos, posts and reviews. New reviews appear under Reviews when it finishes."
            : "Performance, searches, profile, photos and posts.",
          to: data.gbp?.active_sync ? locationPath(locationId, "gbp") : locationPath(locationId, "reputation"),
        }
      : null,
    data.report?.pending
      ? {
          key: "report",
          icon: FileText,
          label: "Preparing the profile report",
          detail: "The profile score, audit and competitor comparison update about 2 minutes after the sync or ranking check.",
          to: locationPath(locationId, "gbp/audit"),
        }
      : null,
  ]
    .filter((item) => item !== null)
    .filter((item) => !(firstRunCard && (item.key === "rankings" || item.key === "report")));
  if (items.length === 0) return null;

  return (
    <section aria-label="Working in the background" aria-live="polite" className={cn("rounded-xl border border-info/25 bg-info-surface px-4 py-3 shadow-card", className)}>
      <ul className="space-y-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex items-start gap-3">
              <span className="relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-card text-info shadow-xs ring-1 ring-inset ring-info/20">
                <Icon aria-hidden className="size-4" />
                <LoaderCircle aria-hidden className="absolute -right-1 -top-1 size-3.5 animate-spin rounded-full bg-card text-info" />
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <Link to={item.to} className="group inline-flex items-center gap-1 rounded-sm font-semibold text-foreground outline-hidden hover:text-info focus-visible:ring-2 focus-visible:ring-ring">
                  {item.label}
                  <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
                <span className="block text-xs text-muted-foreground">{item.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
