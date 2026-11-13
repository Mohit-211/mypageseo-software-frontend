import { Search, Star, X } from "lucide-react";
import type { ReviewsSummary } from "@/api";
import { FilterChips } from "@/components/layout/shared/filter-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DELETED_FILTER_LABEL,
  FLAG_FILTER_LABEL,
  MAX_REVIEW_SEARCH,
  REPLY_FILTER_LABEL,
  REVIEW_SORTS,
  SORT_LABEL,
  hasReviewFilters,
  noReviewFilters,
  type FlagFilter,
  type ReplyFilter,
  type ReviewFilters,
  type ReviewSort,
} from "@/lib/reviews/review-filters";
import { attentionCount } from "@/lib/reviews/review-metrics";
import { cn } from "@/lib/utils";

type Stats = NonNullable<ReviewsSummary["stats"]>;

type QuickView = {
  id: string;
  label: string;
  /** Undefined while unknown (no pill). */
  count: number | undefined;
  reply: ReplyFilter | null;
  flag: FlagFilter | null;
  /** Only the reviews deleted on Google. */
  deleted?: boolean;
  /** Explains the view (tooltip). */
  title?: string;
  /** Left out when its count is 0 (or unknown) and it isn't selected. */
  optional?: boolean;
  /** The count's colour while unselected and above zero. */
  attention?: "critical";
};

function quickViews(stats: Stats, deletedCount: number | undefined): QuickView[] {
  return [
    { id: "all", label: "All", count: stats.total, reply: null, flag: null, title: "Every review still on Google, newest first." },
    {
      id: "needs",
      label: "Needs reply",
      count: stats.unreplied,
      reply: "needs",
      flag: null,
      title: "Reviews without a reply on Google, including drafts not sent yet and replies Google rejected.",
    },
    { id: "drafts", label: "Drafts", count: stats.drafts_pending, reply: "draft", flag: null, title: "Replies written or drafted with AI that haven't been sent yet." },
    {
      // Phase 25a: a to-do (it counts as unanswered), so next to the drafts, in red while it has any.
      id: "rejected",
      label: REPLY_FILTER_LABEL.rejected,
      count: stats.replies_rejected,
      reply: "rejected",
      flag: null,
      title: "Replies Google didn't publish. Read Google's reason on each, then send a new reply.",
      optional: true,
      attention: "critical",
    },
    {
      id: "attention",
      label: "Needs attention",
      count: attentionCount(stats),
      reply: null,
      flag: "attention",
      title: "Reviews our checks marked for a closer look, like a 1-star review without text or a serious complaint.",
    },
    {
      id: "suspicious",
      label: "Suspicious",
      count: stats.suspicious,
      reply: null,
      flag: "suspicious",
      title: "Reviews that may break Google's rules. Ask Google to remove them rather than replying.",
      optional: true,
    },
    {
      id: "pending",
      label: REPLY_FILTER_LABEL.pending,
      count: stats.replies_pending,
      reply: "pending",
      flag: null,
      title: "Replies you sent that Google is still reviewing before they show. This usually takes minutes, sometimes a day.",
      optional: true,
    },
    {
      id: "replied",
      label: "Replied",
      count: Math.max(0, stats.total - stats.unreplied),
      reply: "sent",
      flag: null,
      title: "Reviews with a reply on Google, including replies Google is still reviewing.",
    },
    {
      // Last: a read-only list of reviews no longer on Google (left out of every other view and count).
      id: "deleted",
      label: DELETED_FILTER_LABEL,
      count: deletedCount,
      reply: null,
      flag: null,
      deleted: true,
      title: "Reviews removed from Google, by the reviewer or by Google. They're kept here to read, and left out of your numbers.",
      optional: true,
    },
  ];
}

/**
 * The Reviews page's filters, all kept in the address: quick views with counts (all, needs reply,
 * drafts, rejected by Google, needs attention, suspicious, waiting for Google, replied, deleted on
 * Google), the search box, star ratings and the order. Views that are often empty show up only when
 * they have reviews (or are open).
 */
export function ReviewsToolbar({
  stats,
  filters,
  onChange,
  openTotal,
  deletedCount,
}: {
  stats: Stats;
  filters: ReviewFilters;
  onChange: (patch: Partial<ReviewFilters>) => void;
  /** The listed total for the open view, when nothing else narrows it (keeps the open chip equal to the list). */
  openTotal?: number;
  /** Reviews deleted on Google (`GET reviews?deleted_on_google=true` total), when counted. */
  deletedCount?: number | undefined;
}) {
  const all = quickViews(stats, deletedCount);
  const activeId = all.find((view) => view.reply === filters.reply && view.flag === filters.flag && Boolean(view.deleted) === filters.deleted)?.id ?? null;
  const useOpenTotal = openTotal !== undefined && filters.ratings.length === 0 && !filters.q.trim();
  const views = all.map((view) => (useOpenTotal && view.id === activeId ? { ...view, count: openTotal } : view));
  const activeView = views.find((view) => view.id === activeId) ?? null;
  const filtered = hasReviewFilters(filters);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-card sm:p-4">
      {/* The shared chips (one selected look on every list page); on phones the row bleeds into this
          card's 12px padding instead of the page gutter. */}
      <FilterChips
        aria-label="Quick views"
        value={activeView?.id ?? null}
        options={views
          .filter((view) => !view.optional || (view.count ?? 0) > 0 || view === activeView)
          .map((view) => ({ id: view.id, label: view.label, count: view.count, title: view.title, attention: view.attention }))}
        onChange={(id) => {
          const view = views.find((item) => item.id === id);
          if (view) onChange({ reply: view.reply, flag: view.flag, deleted: Boolean(view.deleted) });
        }}
        className="max-sm:-mx-3 max-sm:w-[calc(100%+1.5rem)] max-sm:px-3"
      />

      {/* A combination from a link (e.g. "no reply yet" + "needs attention") that no quick view matches. */}
      {!activeView ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-muted-foreground">Showing</span>
          {filters.deleted ? <FilterChip label={DELETED_FILTER_LABEL} onClear={() => onChange({ deleted: false })} /> : null}
          {filters.reply ? (
            <FilterChip label={REPLY_FILTER_LABEL[filters.reply]} onClear={() => onChange({ reply: null })} />
          ) : null}
          {filters.flag ? <FilterChip label={FLAG_FILTER_LABEL[filters.flag]} onClear={() => onChange({ flag: null })} /> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          {/* Bound to the address: `onChange` commits each keystroke at once (useReviewFilters), so
              no letter is lost and the caret stays put. Searches stop at the API's 100 characters. */}
          <Input
            type="search"
            aria-label="Search reviews"
            value={filters.q}
            maxLength={MAX_REVIEW_SEARCH}
            placeholder="Search words in reviews"
            className="h-9 pl-9"
            onChange={(event) => onChange({ q: event.target.value })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Star rating" className="flex items-center gap-1">
            {[5, 4, 3, 2, 1].map((stars) => {
              const on = filters.ratings.includes(stars);
              return (
                <button
                  key={stars}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${stars} star${stars === 1 ? "" : "s"}`}
                  onClick={() => onChange({ ratings: on ? filters.ratings.filter((rating) => rating !== stars) : [...filters.ratings, stars] })}
                  className={cn(
                    "inline-flex h-9 min-w-10 cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 text-sm font-semibold tabular-nums transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    on ? "border-warning/50 bg-warning-surface text-warning-foreground" : "border-border-strong bg-card text-foreground hover:bg-accent",
                  )}
                >
                  {stars}
                  <Star aria-hidden className="size-3.5 fill-warning-bright text-warning" strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
          <Select value={filters.sort} onValueChange={(value) => onChange({ sort: value as ReviewSort })}>
            <SelectTrigger className="h-9 w-[10.5rem]" aria-label="Order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_SORTS.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {SORT_LABEL[sort]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered ? (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange(noReviewFilters())}>
              <X aria-hidden /> Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-primary/20 bg-brand-tint py-0.5 pl-2.5 pr-1 font-medium text-primary-hover">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Stop filtering by ${label.toLowerCase()}`}
        className="relative grid size-5 cursor-pointer place-items-center rounded-full outline-hidden after:absolute after:-inset-2 after:content-[''] hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X aria-hidden className="size-3" />
      </button>
    </span>
  );
}
