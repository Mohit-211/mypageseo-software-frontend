import type { ComponentProps } from "react";
import { sameKeyword } from "@/lib/rankings/keywords";
import { useCanEdit } from "@/hooks/use-access";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, Plus } from "lucide-react";
import { isApiError, updateTracking } from "@/api";
import { Button } from "@/components/ui/button";
import { rankingsKey, useTracking } from "@/lib/rankings/use-rankings";

const MAX_KEYWORDS = 20;

/** "Track this keyword" for a GBP search term that isn't a ranking keyword yet (`PUT tracking { keywords }`). */
function TrackKeywordButtonEditor({ locationId, keyword, onTracked }: { locationId: string; keyword: string; onTracked?: () => void }) {
  const queryClient = useQueryClient();
  const tracking = useTracking(locationId);
  const [saving, setSaving] = useState(false);
  const current = tracking.data?.tracking.keywords.map((entry) => entry.text) ?? null;
  if (!current || current.some((text) => sameKeyword(text, keyword))) return null;
  const full = current.length >= MAX_KEYWORDS;

  const track = async () => {
    setSaving(true);
    try {
      await updateTracking(locationId, { keywords: [...current, keyword] });
      await queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      onTracked?.();
      toast.success(`“${keyword}” is now tracked`, { description: "It's measured from the next ranking run." });
    } catch (err) {
      toast.error(isApiError(err) && err.status === 400 && err.message ? err.message : "The keyword couldn't be added. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2 text-xs"
      disabled={saving || full}
      title={full ? `You already track ${MAX_KEYWORDS} keywords` : undefined}
      onClick={() => void track()}
    >
      {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <Plus aria-hidden />} Track this keyword
    </Button>
  );
}

export function TrackKeywordButton(props: ComponentProps<typeof TrackKeywordButtonEditor>) {
  return useCanEdit() ? <TrackKeywordButtonEditor {...props} /> : null;
}
