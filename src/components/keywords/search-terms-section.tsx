import { useState, type ReactNode } from "react";
import { Check, ChevronDown, LoaderCircle, Plus, Search } from "lucide-react";
import type { SearchKeywordsSection } from "@/api";
import { ConnectGbpButton } from "@/components/gbp-audit/connect-gbp-button";
import { SectionHeader } from "@/components/layout/shared/data-display";
import { EmptyState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { TermChange } from "@/components/keywords/term-change";
import { ManageKeywordsLink } from "@/components/ranking/track-keyword-button";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { formatMonth } from "@/lib/datetime";
import { MAX_KEYWORDS, sameKeyword } from "@/lib/keywords/keywords";
import { SEARCHES_TIP, searchCountText } from "@/lib/keywords/search-terms";
import { useTrackKeyword, useTracking, type SearchTerm } from "@/lib/keywords/use-keywords";
import { cn } from "@/lib/utils";

const FIRST = 10;

/**
 * Google search terms: what people typed before finding the Google profile last month (the GBP
 * report's top terms), with one-click "Track". This is the one search-terms component, so the Keywords
 * page (`#searches`) and GBP Overview show the same terms the same way. Whether a term is tracked is
 * worked out here from the current keyword list, never from the report (which keeps the flags it had
 * when it was made), so it is right straight after an edit.
 */
export function SearchTermsSection({
  gbpConnected,
  state,
  terms,
  keywords,
  canEdit,
  onTrack,
  actions,
  id = "searches",
}: {
  gbpConnected: boolean;
  state: "loading" | "ready" | "none" | "error";
  terms: SearchKeywordsSection | null;
  /** The tracked keywords now; null when they couldn't be loaded (then no tracked marks or Track buttons). */
  keywords: readonly string[] | null;
  canEdit: boolean;
  onTrack: (term: SearchTerm) => Promise<unknown>;
  /** On the right of the section header (e.g. "Manage keywords" on GBP Overview). */
  actions?: ReactNode;
  /** The section's id: its address anchor (`#searches` on the Keywords page). */
  id?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const full = (keywords?.length ?? 0) >= MAX_KEYWORDS;
  const list = terms?.top ?? [];
  const shown = showAll ? list : list.slice(0, FIRST);
  const isTracked = (term: SearchTerm) => (keywords ?? []).some((keyword) => sameKeyword(keyword, term.keyword));
  const notTracked = keywords ? list.filter((term) => !isTracked(term)).length : 0;

  const track = async (term: SearchTerm) => {
    if (busy) return;
    setBusy(term.keyword);
    try {
      await onTrack(term);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id={id} aria-label="Google search terms" className="min-w-0 scroll-mt-20">
      <SectionHeader
        icon={Search}
        tone="keywords"
        title="Google search terms"
        description={
          terms
            ? `What people searched on Google to find you in ${formatMonth(terms.latest_month)}.${
                notTracked > 0 ? ` ${notTracked === 1 ? "1 of them isn't" : `${notTracked} of them aren't`} tracked yet.` : ""
              }`
            : "What people type on Google before finding your profile: good keyword ideas."
        }
        actions={actions}
      />
      {!gbpConnected ? (
        <EmptyState
          compact
          variant="not-connected"
          title="Connect Google to see what people search"
          description="Your Google Business Profile reports the searches that found you each month. They make great keywords."
          action={<ConnectGbpButton />}
        />
      ) : state === "loading" ? (
        <SectionSkeleton lines={4} />
      ) : state === "error" || state === "none" || list.length === 0 ? (
        <EmptyState
          compact
          variant="unavailable"
          title="No search terms yet"
          description={
            state === "error"
              ? "The search terms couldn't be loaded right now."
              : "Google reports them about once a month, after your profile's data syncs. They'll show up here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-surface-strong">
              <tr className="border-b border-border-strong text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2.5 sm:px-4">Search term</th>
                <th scope="col" className="hidden px-4 py-2.5 text-right sm:table-cell">
                  <TermWithTip term="Searches">{SEARCHES_TIP}</TermWithTip>
                </th>
                <th scope="col" className="hidden px-4 py-2.5 text-right sm:table-cell">
                  <TermWithTip term="Change">How many more or fewer searches than the month before.</TermWithTip>
                </th>
                <th scope="col" className="px-3 py-2.5 text-right sm:px-4">
                  <span className="sr-only">Tracking</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((term) => {
                const tracked = isTracked(term);
                const counted = term.value != null || term.threshold != null;
                return (
                  <tr key={term.keyword} className="transition-colors hover:bg-accent/60">
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="block font-medium text-foreground">{term.keyword}</span>
                      {/* Phones: one line under the term instead of the Searches and Change columns, so the term keeps the width. */}
                      {counted || term.change != null ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                          {counted ? (
                            <>
                              <span className="tabular-nums text-foreground">{searchCountText(term)}</span> searches
                            </>
                          ) : null}
                          {term.change != null ? (
                            <>
                              {counted ? " · " : ""}
                              <TermChange change={term.change} /> vs the month before
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-foreground sm:table-cell">{searchCountText(term)}</td>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-right sm:table-cell">
                      <TermChange change={term.change} />
                    </td>
                    <td className="px-3 py-2 text-right sm:px-4">
                      {keywords === null ? null : tracked ? (
                        <StatusBadge tone="success" icon={Check} size="sm">
                          Tracked
                        </StatusBadge>
                      ) : canEdit ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={full || busy !== null}
                          title={full ? `You track the maximum of ${MAX_KEYWORDS} keywords.` : `Track “${term.keyword}”`}
                          onClick={() => void track(term)}
                        >
                          {busy === term.keyword ? <LoaderCircle aria-hidden className="animate-spin" /> : <Plus aria-hidden />} Track
                          <span className="sr-only"> “{term.keyword}”</span>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not tracked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length > FIRST ? (
            <div className="border-t border-border px-4 py-2">
              <Button variant="ghost" size="sm" aria-expanded={showAll} onClick={() => setShowAll((open) => !open)}>
                <ChevronDown aria-hidden className={cn("transition-transform", showAll && "rotate-180")} />
                {showAll ? "Show fewer" : `Show all ${list.length}`}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

/**
 * GBP Overview's search terms: the Keywords page's section, with the tracked state read live from
 * the location's keyword list (shared with the Keywords page, so an edit on either page shows on
 * both) and "Track" saving through the Keywords page's rules.
 */
export function ProfileSearchTerms({ locationId, terms }: { locationId: string; terms: SearchKeywordsSection }) {
  const tracking = useTracking(locationId);
  const canEdit = useCanEdit();
  const { track } = useTrackKeyword(locationId);
  return (
    <SearchTermsSection
      gbpConnected
      state={tracking.isPending ? "loading" : "ready"}
      terms={terms}
      keywords={tracking.data ? tracking.data.tracking.keywords.map((keyword) => keyword.text) : null}
      canEdit={canEdit}
      onTrack={(term) => track(term.keyword)}
      id="search-terms"
      actions={<ManageKeywordsLink locationId={locationId} />}
    />
  );
}
