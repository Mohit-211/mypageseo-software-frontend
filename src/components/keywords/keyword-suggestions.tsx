import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Globe, LoaderCircle, MapPin, Plus, Sparkles, Tag } from "lucide-react";
import { suggestKeywords, type KeywordSuggestions as Suggestions } from "@/api";
import { AiBadge } from "@/components/ai/ai-badge";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { AiStatusBanner } from "@/components/ai/ai-status-banner";
import { Button } from "@/components/ui/button";
import { isAiUnavailableError, useAiErrorText } from "@/lib/ai/ai-errors";
import { noteAiError, noteAiSuccess } from "@/lib/ai/ai-signal";
import { aiStatusCopy, useAiStatus } from "@/lib/ai/ai-status";
import { keywordKey, sameKeyword } from "@/lib/keywords/keywords";
import { cn } from "@/lib/utils";

const SOURCE: Record<string, { label: string; icon: typeof Globe }> = {
  website: { label: "From your website", icon: Globe },
  profile: { label: "From your Google profile", icon: MapPin },
  category: { label: "From your business category", icon: Tag },
};

const WEBSITE_NOTE: Record<string, string> = {
  no_website: "There's no website on your profile, so these come from your Google profile.",
  unreachable: "We couldn't read your website, so these come from your Google profile.",
  not_html: "We couldn't read your website, so these come from your Google profile.",
};

/**
 * Suggestions are an AI run (20 per location per day), so they live outside the location's ranking
 * queries: saving keywords reloads those, and must never start another run.
 */
const suggestionsKey = (locationId: string) => ["keyword-suggestions", locationId] as const;

/**
 * Free AI keyword ideas (Phase 22): read from the website and the Google profile. Tick the ones that
 * fit and add them; ideas already in the list (ignoring case and spaces) aren't shown. While AI is
 * off or paused, the calm AI state shows here instead, so the feature never just disappears.
 */
export function KeywordSuggestions({
  locationId,
  keywords,
  onAdd,
  autoRun = false,
  full = false,
}: {
  locationId: string;
  keywords: readonly string[];
  /** Adds the ticked ideas (the caller applies the duplicate and limit rules, and may save). */
  onAdd: (picked: string[]) => void | Promise<unknown>;
  /** Run once on open (the setup step with no keywords yet). */
  autoRun?: boolean;
  /** The list is at its limit: ideas can be read but not added. */
  full?: boolean;
}) {
  const ai = useAiStatus(locationId);
  const [started, setStarted] = useState(autoRun);
  const first = useQuery({
    queryKey: suggestionsKey(locationId),
    queryFn: async () => {
      try {
        const result = await suggestKeywords(locationId);
        noteAiSuccess();
        return result;
      } catch (err) {
        noteAiError(err);
        // AI is off or out of budget: back to the "Get keyword ideas" button, so only a click starts
        // the next run. Otherwise a failed run (no data, so always stale) would run again by itself as
        // soon as AI looked available again (a newer summary, or the 15-minute signal lapsing).
        if (isAiUnavailableError(err)) setStarted(false);
        throw err;
      }
    },
    // Never on its own: only a click (or the setup step's first visit) starts a run. A failed run has no
    // data and counts as stale, so focus and reconnect must not refetch it either.
    enabled: started && ai.state !== "off" && ai.state !== "paused",
    retry: false,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  // Role-aware wording: only people who can pay are offered billing actions.
  const aiErrorTextFor = useAiErrorText();
  const [more, setMore] = useState<Suggestions[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const latest = more.at(-1) ?? first.data;
  const error = moreError ?? first.error;
  const errorCopy = error ? aiErrorTextFor(error, { free: true, fallback: "The ideas didn't come through" }) : null;
  const limitReached = errorCopy?.reason === "suggestion_limit_reached";

  // Every idea so far, without repeats or keywords already in the list.
  const seen = new Set<string>();
  const suggestions = [first.data, ...more]
    .flatMap((round) => round?.suggestions ?? [])
    .filter((suggestion) => {
      const key = keywordKey(suggestion.keyword);
      if (seen.has(key) || keywords.some((keyword) => sameKeyword(keyword, suggestion.keyword))) return false;
      seen.add(key);
      return true;
    });
  const picked = suggestions.filter((suggestion) => selected.has(suggestion.keyword)).map((suggestion) => suggestion.keyword);

  const loadMore = async () => {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const result = await suggestKeywords(locationId, true);
      noteAiSuccess();
      setMore((current) => [...current, result]);
    } catch (err) {
      noteAiError(err);
      // AI off or out of budget shows through the shared AI status (the banner above); keeping it here
      // too would leave its message behind once AI is back.
      setMoreError(isAiUnavailableError(err) ? null : err);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (keyword: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });

  const addSelected = async () => {
    if (picked.length === 0 || adding) return;
    setAdding(true);
    try {
      await onAdd(picked);
      setSelected(new Set());
    } finally {
      setAdding(false);
    }
  };

  // AI off or paused (known before or learned from this call): say so calmly, keep the feature visible.
  // A run that failed that way only counts while it's the current run: once AI looks available again,
  // the button is back and waits for a click.
  const unavailable = ai.state === "off" || ai.state === "paused" || (started && isAiUnavailableError(error));
  if (unavailable) {
    return aiStatusCopy(ai) ? (
      <AiStatusBanner compact status={ai} detail="Keyword ideas switch on with it; type your keywords for now." />
    ) : (
      <p className="flex items-center gap-2 rounded-lg border border-ai/20 bg-ai-surface px-3 py-2 text-sm text-foreground">
        <Sparkles aria-hidden className="size-4 shrink-0 text-ai" />
        {errorCopy ? `${errorCopy.title}. ${errorCopy.description}` : "AI keyword ideas aren't available right now. Type your keywords instead."}
      </p>
    );
  }

  if (!started) {
    const blocked = !ai.canRun && ai.state !== "checking" && ai.state !== "unknown";
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="button" variant="ai" size="sm" disabled={blocked} title={blocked ? ai.reason : undefined} onClick={() => setStarted(true)}>
          <Sparkles aria-hidden /> Get keyword ideas
          <AiCostChip item="keyword_suggestions" variant="inverse" />
        </Button>
        <span className="text-xs text-muted-foreground">AI reads your website and Google profile and suggests searches to track.</span>
      </div>
    );
  }

  return (
    <section aria-label="AI keyword ideas" className="space-y-3 rounded-xl border border-ai/20 bg-ai-surface/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <AiBadge /> Keyword ideas
          {latest && latest.runs_left_today <= 5 ? (
            <span className="text-xs font-normal text-muted-foreground">
              {latest.runs_left_today} idea run{latest.runs_left_today === 1 ? "" : "s"} left today
            </span>
          ) : null}
        </p>
        {picked.length > 0 ? (
          <Button type="button" size="sm" disabled={adding || full} onClick={() => void addSelected()}>
            {adding ? <LoaderCircle aria-hidden className="animate-spin" /> : <Plus aria-hidden />} Add {picked.length} selected
          </Button>
        ) : null}
      </div>

      {first.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle aria-hidden className="size-4 animate-spin text-ai" /> Reading your website and Google profile… this takes a few seconds.
        </p>
      ) : null}
      {latest?.website_note && WEBSITE_NOTE[latest.website_note] ? (
        <p className="text-xs text-muted-foreground">{WEBSITE_NOTE[latest.website_note]}</p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {suggestions.map((suggestion) => {
            const on = selected.has(suggestion.keyword);
            const source = SOURCE[suggestion.source];
            const SourceIcon = source?.icon ?? Sparkles;
            return (
              <li key={suggestion.keyword}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => toggle(suggestion.keyword)}
                  className={cn(
                    "flex h-full min-h-14 w-full cursor-pointer items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left shadow-xs transition-[border-color,box-shadow] outline-hidden hover:border-ai/50 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                    on ? "border-ai ring-1 ring-ai" : "border-border",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors",
                      on ? "border-ai bg-ai text-ai-foreground" : "border-input bg-card",
                    )}
                  >
                    {on ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{suggestion.keyword}</span>
                    <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                      <SourceIcon aria-hidden className="mt-px size-3.5 shrink-0" />
                      <span>{suggestion.reason || source?.label || "Suggested"}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : first.isSuccess && !loadingMore ? (
        <p className="text-sm text-muted-foreground">Every idea is already in your list.</p>
      ) : null}

      {errorCopy && !first.isPending ? (
        <p role={limitReached ? "status" : "alert"} className={cn("text-sm", errorCopy.tone === "critical" ? "text-critical" : "text-muted-foreground")}>
          <span className="font-medium">{errorCopy.title}.</span> {errorCopy.description}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {first.isError && !limitReached ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void first.refetch()}>Try again</Button>
        ) : null}
        {latest?.can_suggest_more && !limitReached ? (
          <Button type="button" size="sm" variant="ghost" className="text-ai hover:text-ai" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} Suggest more
          </Button>
        ) : null}
      </div>
    </section>
  );
}
