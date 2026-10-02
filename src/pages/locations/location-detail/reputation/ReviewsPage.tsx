import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, MessageSquareText, RefreshCw, Search, Send, Sparkles, X } from "lucide-react";
import {
  analyzeReviews,
  generateReplyDrafts,
  refreshReviews,
  sendReplies,
  apiErrorData,
  isApiError,
  type ReplyState,
  type ReviewsQuery,
  type ReviewsSummary,
} from "@/api";
import { MetricCard, PageHeader } from "@/components/layout/shared/data-display";
import { TablePagination } from "@/components/layout/shared/data-table";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { ReviewCard } from "@/components/reputation/review-card";
import { BackgroundActivity } from "@/components/location/background-activity";
import { ReportButton } from "@/components/report/rank-report-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGbpContext } from "@/lib/gbp/gbp-context";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { reviewsKey, useReviewsList, useReviewsSummary } from "@/lib/reviews/use-reviews";
import { formatRunDate } from "@/lib/rankings/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const MAX_AI_BATCH = 20;

type Filters = {
  ratings: number[];
  replyState: ReplyState | "all";
  flagged: "all" | "any" | "suspicious" | "attention" | "none";
  search: string;
  sort: NonNullable<ReviewsQuery["sort"]>;
};

const EMPTY_FILTERS: Filters = { ratings: [], replyState: "all", flagged: "all", search: "", sort: "newest" };

function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Reviews: one page to read, reply, check flags and draft removal requests. AI only on request. */
function ReviewsPage() {
  const { location } = useGbpContext();
  const locationId = location.location_id;
  const summary = useReviewsSummary(locationId);
  const { connect } = useGbpConnect();

  const header = (
    <PageHeader
      title="Reviews"
      description="Read and answer Google reviews, see which need attention, and get AI help when you want it."
      meta={summary.data ? <RefreshMeta summary={summary.data} /> : undefined}
      actions={
        summary.data ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <RefreshReviewsButton locationId={locationId} summary={summary.data} />
            {summary.data.stats && summary.data.stats.total > 0 ? (
              <ReportButton locationId={locationId} type="reputation" subtitle="Review summary, star distribution, reviews needing attention, replies sent and insights, as a PDF." />
            ) : null}
          </div>
        ) : undefined
      }
    />
  );

  if (summary.isPending) return <>{header}<PageSkeleton /></>;
  if (summary.isError) {
    return <>{header}<ErrorState description={reviewErrorMessage(summary.error, "Reviews couldn't be loaded.").message} onRetry={() => void summary.refetch()} /></>;
  }
  if (!summary.data.gbp_connected) {
    return (
      <>
        {header}
        <EmptyState
          icon={MessageSquareText}
          title="Connect the Google Business Profile"
          description="Reviews come from the location's Google Business Profile."
          action={<Button size="sm" onClick={() => connect()}>Connect Google</Button>}
        />
      </>
    );
  }
  if (!summary.data.v4_enabled) {
    return <>{header}<EmptyState icon={MessageSquareText} title="Waiting for Google access" description="Reviews need a Google API approval that is still pending. They appear here as soon as it's granted." /></>;
  }

  return (
    <>
      {header}
      <BackgroundActivity locationId={locationId} className="mb-4" />
      <Stats summary={summary.data} />
      <ReviewsList locationId={locationId} summary={summary.data} />
    </>
  );
}

function RefreshMeta({ summary }: { summary: ReviewsSummary }) {
  return (
    <p className="text-xs text-muted-foreground">
      {summary.last_refreshed_at ? `Last checked with Google ${formatRunDate(summary.last_refreshed_at, true)}` : summary.last_synced_at ? `Last synced ${formatRunDate(summary.last_synced_at, true)}` : "Not checked with Google yet"}
      {summary.ai.configured ? ` · ${summary.ai.token_balance} tokens for AI` : ""}
    </p>
  );
}

function RefreshReviewsButton({ locationId, summary }: { locationId: string; summary: ReviewsSummary }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const nextAllowed = summary.next_refresh_allowed_at ? new Date(summary.next_refresh_allowed_at).getTime() : 0;
  const waiting = nextAllowed > now;

  const refresh = async () => {
    setBusy(true);
    try {
      const result = await refreshReviews(locationId);
      toast.success(result.new_reviews || result.updated_reviews ? `${result.new_reviews} new, ${result.updated_reviews} updated.` : "No new reviews.");
    } catch (err) {
      if (isApiError(err) && err.reason === "rate_limited") {
        const next = apiErrorData(err).next_allowed_at;
        toast.error(`Reviews were checked a moment ago. Try again ${typeof next === "string" ? formatRunDate(next, true) : "in a few minutes"}.`);
      } else {
        toast.error(reviewErrorMessage(err, "Reviews couldn't be refreshed.").message);
      }
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) });
    }
  };

  return (
    <Button variant="outline" size="sm" disabled={busy || waiting} onClick={() => void refresh()} title={waiting ? `Available ${formatRunDate(summary.next_refresh_allowed_at, true)}` : undefined}>
      {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
      {waiting ? "Checked recently" : "Refresh Reviews"}
    </Button>
  );
}

function Stats({ summary }: { summary: ReviewsSummary }) {
  const stats = summary.stats;
  if (!stats) return null;
  return (
    <section aria-label="Review summary" className="mb-6">
      <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-border">
        <MetricCard label="Rating" value={stats.average_rating?.toFixed(1) ?? "—"} caption={`${stats.total.toLocaleString()} reviews · ${stats.new_this_month} new this month`} />
        <MetricCard label="Needs attention" value={stats.awaiting_attention} caption="Unanswered 1–3 stars or flagged" />
        <MetricCard label="Flagged" value={stats.flagged} caption={`${stats.suspicious} with suspicious indicators`} />
        <MetricCard label="Drafts waiting" value={stats.drafts_pending} caption={`${stats.unreplied} reviews without a reply`} />
        <MetricCard label="Replies sent" value={stats.replies_sent_this_month} caption="This month" />
      </div>
    </section>
  );
}

function ReviewsList({ locationId, summary }: { locationId: string; summary: ReviewsSummary }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const search = useDebounced(filters.search.trim());

  const query: ReviewsQuery = {
    ...(filters.ratings.length ? { rating: filters.ratings.join(",") } : {}),
    ...(filters.replyState !== "all" ? { reply_state: filters.replyState } : {}),
    ...(filters.flagged !== "all" ? { flagged: filters.flagged } : {}),
    ...(search ? { search } : {}),
    sort: filters.sort,
    page,
    limit: PAGE_SIZE,
  };
  const list = useReviewsList(locationId, query);
  const reviews = list.data?.reviews ?? [];
  const chosen = reviews.filter((review) => selected.has(review.review_id));
  const ai = summary.ai;
  const aiUsable = ai.configured && !ai.paused_today;
  const eligibleForDrafts = chosen.filter((review) => review.ai_reply_eligible).length;
  const withDrafts = chosen.filter((review) => review.draft).length;
  const batches = (count: number) => Math.ceil(count / 10);

  const update = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
    setSelected(new Set());
  };
  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const bulk = async (key: string, action: () => Promise<string>) => {
    setBusy(key);
    try {
      toast.success(await action());
      setSelected(new Set());
    } catch (err) {
      const { message, buyTokens } = reviewErrorMessage(err, "That didn't work. Try again.");
      toast.error(message, buyTokens ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined);
    } finally {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: ["billing", "tokens"] });
    }
  };
  const ids = chosen.map((review) => review.review_id).slice(0, MAX_AI_BATCH);

  const filtered = filters.ratings.length > 0 || filters.replyState !== "all" || filters.flagged !== "all" || Boolean(search);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-card lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search reviews" value={filters.search} placeholder="Search text or reviewer" className="h-9 pl-9" onChange={(e) => update({ search: e.target.value })} />
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Stars">
          {[5, 4, 3, 2, 1].map((stars) => {
            const on = filters.ratings.includes(stars);
            return (
              <button
                key={stars}
                type="button"
                aria-pressed={on}
                onClick={() => update({ ratings: on ? filters.ratings.filter((r) => r !== stars) : [...filters.ratings, stars] })}
                className={cn("rounded-md border px-2 py-1 text-xs font-medium", on ? "border-primary bg-brand-tint text-primary" : "border-border text-muted-foreground hover:bg-muted/40")}
              >
                {stars}★
              </button>
            );
          })}
        </div>
        <Select value={filters.replyState} onValueChange={(value) => update({ replyState: value as Filters["replyState"] })}>
          <SelectTrigger className="h-9 w-full bg-background lg:w-40" aria-label="Reply"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any reply status</SelectItem>
            <SelectItem value="none">Not replied</SelectItem>
            <SelectItem value="draft">Draft waiting</SelectItem>
            <SelectItem value="sent">Replied</SelectItem>
            <SelectItem value="failed">Send failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.flagged} onValueChange={(value) => update({ flagged: value as Filters["flagged"] })}>
          <SelectTrigger className="h-9 w-full bg-background lg:w-48" aria-label="Flags"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Flagged or not</SelectItem>
            <SelectItem value="any">Any flag</SelectItem>
            <SelectItem value="attention">Needs attention</SelectItem>
            <SelectItem value="suspicious">Suspicious indicators</SelectItem>
            <SelectItem value="none">Not flagged</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.sort} onValueChange={(value) => update({ sort: value as Filters["sort"] })}>
          <SelectTrigger className="h-9 w-full bg-background lg:w-40" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="rating_asc">Lowest rating</SelectItem>
            <SelectItem value="rating_desc">Highest rating</SelectItem>
          </SelectContent>
        </Select>
        {filtered ? <Button variant="ghost" size="sm" onClick={() => update(EMPTY_FILTERS)}><X aria-hidden /> Clear</Button> : null}
      </div>

      {chosen.length > 0 ? (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-brand-tint px-3 py-2 shadow-card">
          <span className="text-sm font-medium text-foreground">{chosen.length} selected</span>
          {aiUsable ? (
            <>
              <Button
                size="sm"
                disabled={busy !== null || eligibleForDrafts === 0}
                title={eligibleForDrafts === 0 ? "AI drafts are only for 4–5 star reviews without a reply" : undefined}
                onClick={() =>
                  void bulk("drafts", async () => {
                    const result = await generateReplyDrafts(locationId, ids);
                    return `${result.generated} drafted, ${result.reused} reused${result.skipped.length ? `, ${result.skipped.length} skipped` : ""}.`;
                  })
                }
              >
                {busy === "drafts" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                Generate replies ({eligibleForDrafts} · ≈{batches(eligibleForDrafts) * ai.token_costs.reply_drafts_per_10} tokens)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  void bulk("analyze", async () => {
                    const result = await analyzeReviews(locationId, ids);
                    return `${result.analyzed} analyzed, ${result.reused} reused${result.skipped.length ? `, ${result.skipped.length} without text skipped` : ""}.`;
                  })
                }
              >
                {busy === "analyze" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                Analyze selected (≈{batches(chosen.length) * ai.token_costs.analysis_per_10} tokens)
              </Button>
            </>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null || withDrafts === 0}
            onClick={() =>
              void bulk("send", async () => {
                const result = await sendReplies(locationId, chosen.filter((review) => review.draft).map((review) => review.review_id));
                return `${result.sent} replies published${result.failed ? `, ${result.failed} failed` : ""}.`;
              })
            }
          >
            {busy === "send" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />}
            Send {withDrafts} draft{withDrafts === 1 ? "" : "s"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
          {ai.paused_today ? <span className="text-xs text-muted-foreground">AI is paused for today.</span> : null}
          {chosen.length > MAX_AI_BATCH ? <span className="text-xs text-muted-foreground">AI works on {MAX_AI_BATCH} at a time.</span> : null}
        </div>
      ) : null}

      {list.isPending ? (
        <PageSkeleton />
      ) : list.isError ? (
        <ErrorState description={reviewErrorMessage(list.error, "Reviews couldn't be loaded.").message} onRetry={() => void list.refetch()} />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title={filtered ? "No reviews match these filters" : "No reviews yet"}
          description={filtered ? "Change the filters to see other reviews." : "New reviews appear after the next Refresh Reviews or Google sync."}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-primary)]"
                checked={chosen.length === reviews.length}
                onChange={(event) => setSelected(event.target.checked ? new Set(reviews.map((review) => review.review_id)) : new Set())}
              />
              Select all on this page
            </label>
            <span className="flex items-center gap-1">
              {list.data.total.toLocaleString()} review{list.data.total === 1 ? "" : "s"}
              <TermWithTip term={<span className="sr-only">About flags</span>}>
                Flags are checks on each review (links, contact details, repeated text, sudden low ratings…). “Suspicious indicators” means a review may break Google's rules; it is not proof the review is fake.
              </TermWithTip>
            </span>
          </div>
          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard
                key={review.review_id}
                locationId={locationId}
                review={review}
                summary={summary}
                selected={selected.has(review.review_id)}
                onSelect={(checked) => toggle(review.review_id, checked)}
              />
            ))}
          </div>
          <TablePagination
            page={page}
            pageCount={Math.max(1, Math.ceil(list.data.total / PAGE_SIZE))}
            totalItems={list.data.total}
            pageSize={PAGE_SIZE}
            onPageChange={(next) => {
              setPage(next);
              setSelected(new Set());
            }}
            itemLabel="reviews"
          />
          {list.data.attribution ? <p className="text-[11px] text-muted-foreground">{list.data.attribution.text}</p> : null}
        </>
      )}
    </div>
  );
}

export default ReviewsPage;
