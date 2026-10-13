import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { isApiError, suggestKeywords, type KeywordSuggestions as Suggestions } from "@/api";
import { Button } from "@/components/ui/button";
import { keywordKey, sameKeyword } from "@/lib/rankings/keywords";
import { rankingsKey } from "@/lib/rankings/use-rankings";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  website: "From your website",
  profile: "From your Google profile",
  category: "From your category",
};

const WEBSITE_NOTE: Record<string, string> = {
  no_website: "No website on your profile; suggestions are based on your Google profile.",
  unreachable: "We couldn't read your website; suggestions are based on your Google profile.",
  not_html: "We couldn't read your website; suggestions are based on your Google profile.",
};

function errorText(err: unknown): string {
  if (!isApiError(err)) return "Suggestions couldn't be loaded. Try again.";
  switch (err.reason) {
    case "suggestion_limit_reached":
      return "That's all for today. You can still type your own keywords.";
    case "ai_not_configured":
      return "Keyword suggestions aren't available yet. Type your keywords instead.";
    case "ai_budget_reached":
      return "AI is paused for today. Type your keywords instead.";
    case "ai_failed":
      return "The suggestions didn't come through. Try again; nothing was charged.";
    default:
      return err.message || "Suggestions couldn't be loaded. Try again.";
  }
}

/**
 * AI keyword suggestions (Phase 22): free, from the website and the Google profile. Tick the ones
 * that fit and "Add selected"; suggestions already in the list (ignoring case and spaces) aren't shown.
 */
export function KeywordSuggestions({
  locationId,
  keywords,
  onAdd,
  autoRun = false,
}: {
  locationId: string;
  keywords: string[];
  /** Adds the ticked suggestions (the caller applies the duplicate and limit rules). */
  onAdd: (picked: string[]) => void;
  /** Run once on open (the setup step with no keywords yet). */
  autoRun?: boolean;
}) {
  const [started, setStarted] = useState(autoRun);
  const first = useQuery({
    queryKey: [...rankingsKey(locationId), "keyword-suggestions"],
    queryFn: () => suggestKeywords(locationId),
    enabled: started,
    retry: false,
    staleTime: Infinity,
  });
  const [more, setMore] = useState<Suggestions[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const latest = more.at(-1) ?? first.data;
  const error = moreError ?? first.error;
  const limitReached = isApiError(error) && error.reason === "suggestion_limit_reached";
  const hidden = isApiError(error) && error.reason === "ai_not_configured";

  // Every suggestion so far, without repeats or keywords already in the list.
  const seen = new Set<string>();
  const suggestions = [first.data, ...more]
    .flatMap((round) => round?.suggestions ?? [])
    .filter((suggestion) => {
      const key = keywordKey(suggestion.keyword);
      if (seen.has(key) || keywords.some((keyword) => sameKeyword(keyword, suggestion.keyword))) return false;
      seen.add(key);
      return true;
    });

  const loadMore = async () => {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const result = await suggestKeywords(locationId, true);
      setMore((current) => [...current, result]);
    } catch (err) {
      setMoreError(err);
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

  const addSelected = () => {
    onAdd(suggestions.filter((suggestion) => selected.has(suggestion.keyword)).map((suggestion) => suggestion.keyword));
    setSelected(new Set());
  };

  if (hidden) return null;
  if (!started) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setStarted(true)}>
        <Sparkles aria-hidden /> Suggest keywords (free)
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/25 bg-brand-tint/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Sparkles aria-hidden className="size-4 text-primary" /> Suggested keywords
        </p>
        {selected.size > 0 ? (
          <Button type="button" size="sm" onClick={addSelected}>
            <Plus aria-hidden /> Add selected ({selected.size})
          </Button>
        ) : null}
      </div>

      {first.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle aria-hidden className="size-4 animate-spin" /> Reading your website and Google profile… (a few seconds)
        </p>
      ) : null}
      {latest?.website_note && WEBSITE_NOTE[latest.website_note] ? (
        <p className="text-xs text-muted-foreground">{WEBSITE_NOTE[latest.website_note]}</p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {suggestions.map((suggestion) => {
            const on = selected.has(suggestion.keyword);
            return (
              <li key={suggestion.keyword}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(suggestion.keyword)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                    on ? "border-primary bg-background" : "border-border bg-background/70 hover:bg-background",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                    )}
                  >
                    {on ? <Check aria-hidden className="size-3" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{suggestion.keyword}</span>
                    <span className="block text-xs text-muted-foreground">
                      {SOURCE_LABEL[suggestion.source] ?? "Suggested"} · {suggestion.reason}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : first.isSuccess && !loadingMore ? (
        <p className="text-sm text-muted-foreground">Every suggestion is already in your list.</p>
      ) : null}

      {error ? <p role="alert" className={cn("text-sm", limitReached ? "text-muted-foreground" : "text-critical")}>{errorText(error)}</p> : null}

      <div className="flex flex-wrap gap-2">
        {first.isError && !limitReached ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => void first.refetch()}>Try again</Button>
        ) : null}
        {latest?.can_suggest_more && !limitReached ? (
          <Button type="button" size="sm" variant="ghost" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} Suggest more
          </Button>
        ) : null}
      </div>
    </div>
  );
}
