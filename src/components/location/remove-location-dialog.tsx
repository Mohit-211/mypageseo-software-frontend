import { useQuery } from "@tanstack/react-query";
import type { ReviewsSummary } from "@/api";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { unusedCreditsNote } from "@/lib/billing/ai-credits";
import { reviewsSummaryQuery } from "@/lib/reviews/use-reviews";

const selectCredits = (summary: ReviewsSummary) => summary.ai?.credits ?? null;

/**
 * "Delete <location>?" on the Locations page. Besides what deleting does to tracking and the paid slot, it says
 * that the location's AI data goes with it (25a: its AI facts and settings; 2026-11-16: its business brief, post
 * ideas and logo), and when the location still has AI replies or analyses left (its reviews summary's
 * `ai.credits`, 2026-11-17): a block nobody used is refunded, but what's left of a started block is lost. Without
 * those counters (no Google connection, the summary failed) it says nothing about them.
 */
export function RemoveLocationDialog({
  location,
  onOpenChange,
  onConfirm,
}: {
  /** The location to delete; null keeps the dialog closed. */
  location: { location_id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const credits = useQuery({
    ...reviewsSummaryQuery(location?.location_id ?? ""),
    enabled: Boolean(location),
    select: selectCredits,
    retry: false,
  });
  const note = location ? unusedCreditsNote(credits.data) : null;
  return (
    <ConfirmDialog
      open={location !== null}
      onOpenChange={onOpenChange}
      title={`Delete ${location?.name ?? "this location"}?`}
      description={
        <>
          Tracking stops and scheduled checks are cancelled. History is kept, and the place can be added again later, but its AI settings, facts,
          post ideas and logo are deleted. The paid slot isn’t refunded; it stays paid and reusable for another location until the period ends.
          {note ? (
            <>
              {" "}
              <span className="font-medium text-foreground">{note}</span>
            </>
          ) : null}
        </>
      }
      cancelLabel="Keep location"
      confirmLabel="Delete"
      onConfirm={onConfirm}
    />
  );
}
