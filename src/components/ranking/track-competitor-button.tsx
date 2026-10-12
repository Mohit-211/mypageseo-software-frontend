import type { ComponentProps } from "react";
import { useCanEdit } from "@/hooks/use-access";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, Plus } from "lucide-react";
import { isApiError, updateTracking } from "@/api";
import { Button } from "@/components/ui/button";
import { rankingsKey, useTracking } from "@/lib/rankings/use-rankings";

const MAX_COMPETITORS = 5;

/**
 * "Track this competitor" for a business listed on a page but not tracked yet
 * (Map Ranking rows, GBP "Top in your area" rows). Saves `PUT tracking { competitors }`.
 * Hidden when it's already tracked.
 */
function TrackCompetitorButtonEditor({ locationId, placeId, name }: { locationId: string; placeId: string; name: string | null }) {
  const queryClient = useQueryClient();
  const tracking = useTracking(locationId);
  const [saving, setSaving] = useState(false);
  const current = tracking.data?.tracking.competitors ?? null;
  if (!current || current.includes(placeId)) return null;
  const full = current.length >= MAX_COMPETITORS;

  const track = async () => {
    setSaving(true);
    try {
      await updateTracking(locationId, { competitors: [...current, placeId] });
      await queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      toast.success(`${name ?? "The business"} is now tracked`, { description: "Its ranks appear from the next ranking run." });
    } catch (err) {
      const reason = isApiError(err) ? err.reason : undefined;
      toast.error(
        reason === "too_many_competitors"
          ? `You can track up to ${MAX_COMPETITORS} competitors.`
          : reason === "own_place_id"
            ? "That's your own business."
            : "The competitor couldn't be added. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 shrink-0 px-2 text-xs"
      disabled={saving || full}
      title={full ? `You already track ${MAX_COMPETITORS} competitors` : undefined}
      onClick={() => void track()}
    >
      {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <Plus aria-hidden />} Track
    </Button>
  );
}

export function TrackCompetitorButton(props: ComponentProps<typeof TrackCompetitorButtonEditor>) {
  return useCanEdit() ? <TrackCompetitorButtonEditor {...props} /> : null;
}
