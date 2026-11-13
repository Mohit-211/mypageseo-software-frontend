import { useState, type ReactNode, type Ref } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, LoaderCircle, Plus, Search } from "lucide-react";
import { KeywordSuggestions } from "@/components/keywords/keyword-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addKeywords, MAX_KEYWORDS, sameKeyword } from "@/lib/keywords/keywords";
import { searchCountText } from "@/lib/keywords/search-terms";
import { keywordErrorText, type KeywordErrorText, type SearchTerm } from "@/lib/keywords/use-keywords";
import { cn } from "@/lib/utils";

/** How many of Google's search terms to offer as one-click adds. */
const TERM_CHIPS = 8;

/**
 * Adding keywords: typed (several at once with ";"), free AI ideas, and one-click chips for the
 * searches people already use to find the profile. Used by the Keywords page (each add saves) and
 * the setup wizard (adds to a draft that "Save and continue" saves).
 */
export function KeywordComposer({
  locationId,
  keywords,
  onAdd,
  searchTerms,
  autoSuggest = false,
  inputRef,
  inputId = "keyword-composer-input",
  hint,
  className,
}: {
  locationId: string;
  /** The current list (saved, or the setup draft). */
  keywords: readonly string[];
  /** Called with the whole new list and what was added; a promise keeps the composer busy until it settles. */
  onAdd: (next: string[], added: string[]) => void | Promise<unknown>;
  /** Google search terms of the profile; the ones not tracked yet become one-click chips. */
  searchTerms?: readonly SearchTerm[] | null;
  /** Start the AI ideas on open (an empty list in setup). */
  autoSuggest?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  inputId?: string;
  /** The line under the input. */
  hint?: ReactNode;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<KeywordErrorText | null>(null);
  const [busy, setBusy] = useState(false);
  const full = keywords.length >= MAX_KEYWORDS;

  const terms = (searchTerms ?? [])
    .filter((term) => !keywords.some((keyword) => sameKeyword(keyword, term.keyword)))
    .slice(0, TERM_CHIPS);

  /** Adds `input` ("a; b"); returns true when something was added and saved. */
  const add = async (input: string): Promise<boolean> => {
    const result = addKeywords(keywords, input);
    setNotice(result.message);
    setError(null);
    if (result.added.length === 0) return false;
    setBusy(true);
    try {
      await onAdd(result.keywords, result.added);
      return true;
    } catch (err) {
      setError(keywordErrorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!draft.trim() || busy) return;
    const result = addKeywords(keywords, draft);
    const added = await add(draft);
    // Keep the text when nothing could be added, so it can be fixed.
    if (added || (!result.message && result.added.length === 0)) setDraft("");
  };

  return (
    <div className={cn("space-y-3", className)}>
      <form
        noValidate
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Plus aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            id={inputId}
            aria-label="New keywords"
            aria-describedby={`${inputId}-hint`}
            value={draft}
            maxLength={2000}
            disabled={full}
            placeholder={full ? `You track the maximum of ${MAX_KEYWORDS} keywords` : "Type keywords, separated by ;"}
            className="h-10 pl-9"
            onChange={(event) => {
              setDraft(event.target.value);
              setNotice(null);
              setError(null);
            }}
          />
        </div>
        <Button type="submit" className="h-10 sm:w-auto" disabled={full || busy || !draft.trim()} aria-busy={busy || undefined}>
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <Plus aria-hidden />} Add
        </Button>
      </form>
      <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
        {full
          ? `You track the maximum of ${MAX_KEYWORDS} keywords for this location. Remove one to add another.`
          : (hint ?? "For example: emergency plumber; drain cleaning. Use the words customers type into Google Maps.")}
      </p>

      {notice ? <p role="status" className="text-sm text-warning-foreground">{notice}</p> : null}
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/25 bg-critical-surface px-3 py-2.5 text-sm text-foreground">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-critical" />
          <span>
            {error.message}{" "}
            {error.billing ? (
              <Link to="/settings/billing" className="font-medium text-primary underline-offset-2 hover:underline">
                Go to billing
              </Link>
            ) : null}
          </span>
        </p>
      ) : null}

      {terms.length > 0 && !full ? (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Search aria-hidden className="size-3.5" /> From your Google searches
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Search terms you don't track yet">
            {terms.map((term) => (
              <li key={term.keyword}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void add(term.keyword)}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-chart-3/30 bg-card py-1 pl-2 pr-2.5 text-xs font-medium text-foreground shadow-xs transition-colors outline-hidden hover:border-chart-3/60 hover:bg-chart-3/8 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:border-border disabled:text-muted-foreground"
                  title={`Track “${term.keyword}”`}
                >
                  <Plus aria-hidden className="size-3.5 text-chart-3" />
                  {term.keyword}
                  {/* The same words as the search terms table below ("fewer than 15", never "< 15"). */}
                  {term.value != null || term.threshold != null ? (
                    <>
                      <span className="tabular-nums text-muted-foreground">{searchCountText(term, { inline: true })}</span>
                      <span className="sr-only">searches last month</span>
                    </>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Keyed by location: a run started, ideas fetched or ticked for one location never carry over to another. */}
      <KeywordSuggestions
        key={locationId}
        locationId={locationId}
        keywords={keywords}
        autoRun={autoSuggest}
        full={full}
        onAdd={async (picked) => {
          await add(picked.join("\n"));
        }}
      />
    </div>
  );
}
