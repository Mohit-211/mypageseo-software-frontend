import { useMemo, useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { MetricCard, Panel, SectionHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, MetricSkeletonGrid, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REVIEWS_PAGE_SIZE,
  type GbpReview,
  type GbpReviewsData,
} from "@/lib/mypageseo/gbp-reviews";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/layout/shared/data-table";

export function GbpReviewsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading reviews">
      <MetricSkeletonGrid count={4} />
      <Skeleton className="h-12 w-full" />
      <TableSkeleton rows={6} columns={4} />
    </div>
  );
}

function Rating({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">Rating unavailable</span>;
  return (
    <span role="img" className="inline-flex items-center gap-1" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          aria-hidden
          className={cn("size-3.5", step <= value ? "fill-warning text-warning" : "text-border")}
        />
      ))}
    </span>
  );
}

function ResponseBadge({ review }: { review: GbpReview }) {
  if (review.responseState === "responded") return <StatusBadge tone="success">Responded</StatusBadge>;
  if (review.responseState === "unanswered") return <StatusBadge tone="critical">Needs a reply</StatusBadge>;
  return <StatusBadge tone="neutral">Response unavailable</StatusBadge>;
}

type RatingFilter = "all" | "1" | "2" | "3" | "4" | "5";
type StatusFilter = "all" | "unanswered" | "responded" | "unavailable";
type SortOption = "newest" | "oldest" | "rating_high" | "rating_low";

export function GbpReviewsContent({ data, onRetry }: { data: GbpReviewsData; onRetry: () => void }) {
  const [rating, setRating] = useState<RatingFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<GbpReview | null>(null);

  const filtered = useMemo(() => {
    const rows = data.reviews.filter((review) => {
      if (rating !== "all" && review.rating !== Number(rating)) return false;
      if (status !== "all" && review.responseState !== status) return false;
      if (data.capabilities.canSearch && search.trim()) {
        const needle = search.trim().toLowerCase();
        const haystack = `${review.reviewer ?? ""} ${review.text ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sort === "rating_high") return (b.rating ?? -1) - (a.rating ?? -1);
      if (sort === "rating_low") return (a.rating ?? 99) - (b.rating ?? 99);
      const at = a.timestamp ?? "";
      const bt = b.timestamp ?? "";
      return sort === "newest" ? bt.localeCompare(at) : at.localeCompare(bt);
    });
  }, [data.reviews, data.capabilities.canSearch, rating, status, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / REVIEWS_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * REVIEWS_PAGE_SIZE, current * REVIEWS_PAGE_SIZE);
  const hasFilters = rating !== "all" || status !== "all" || search.trim() !== "";

  if (data.status === "loading") return <GbpReviewsLoading />;
  if (data.status === "error") {
    return (
      <ErrorState
        title="Reviews could not be loaded"
        description="We couldn't load reviews for this profile. Try again without leaving the location."
        onRetry={onRetry}
      />
    );
  }
  if (data.status === "disconnected") {
    return (
      <EmptyState
        title="Google Business Profile is not connected"
        description="Connect this location's Google Business Profile before reviews, reply status, and response tools can be shown. Connection is not available in the current product integration."
        className="min-h-72"
      />
    );
  }
  if (data.status === "no_reviews" || data.reviews.length === 0) {
    return (
      <div className="space-y-6">
        <SummaryBand data={data} />
        <EmptyState
          title="No reviews are available yet"
          description="This profile is connected, but review synchronization has not returned any reviews. Reviews will appear here once they are available."
          className="min-h-64"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryBand data={data} />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(value) => { setStatus(value as StatusFilter); setPage(1); }}>
            <SelectTrigger className="h-9 w-[170px] text-xs" aria-label="Response status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reviews</SelectItem>
              <SelectItem value="unanswered">Needs a reply</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
              <SelectItem value="unavailable">Response unavailable</SelectItem>
            </SelectContent>
          </Select>
          <Select value={rating} onValueChange={(value) => { setRating(value as RatingFilter); setPage(1); }}>
            <SelectTrigger className="h-9 w-[140px] text-xs" aria-label="Rating"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ratings</SelectItem>
              {[5, 4, 3, 2, 1].map((value) => (
                <SelectItem key={value} value={String(value)}>{value} star{value === 1 ? "" : "s"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
            <SelectTrigger className="h-9 w-[150px] text-xs" aria-label="Sort reviews"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="rating_high">Highest rating</SelectItem>
              <SelectItem value="rating_low">Lowest rating</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={() => { setRating("all"); setStatus("all"); setSearch(""); setPage(1); }}>Reset</Button>
          ) : null}
        </div>
        {data.capabilities.canSearch ? (
          <Input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search reviews"
            aria-label="Search reviews"
            className="h-9 w-full text-sm lg:w-64"
          />
        ) : null}
      </div>

      <Panel title="Reviews" description={`${filtered.length.toLocaleString()} of ${data.reviews.length.toLocaleString()} reviews`}>
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No reviews match the current filters.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((review) => (
              <li key={review.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{review.reviewer ?? "Reviewer unavailable"}</span>
                    <Rating value={review.rating} />
                    <span className="text-xs text-muted-foreground">{review.date ?? "Date unavailable"}</span>
                    <ResponseBadge review={review} />
                  </div>
                  <p className="mt-1.5 line-clamp-3 max-w-3xl text-sm text-foreground">{review.text ?? "This review has no text."}</p>
                  {review.responseText ? (
                    <p className="mt-2 line-clamp-2 max-w-3xl border-l-2 border-primary/40 pl-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Published response{review.responseDate ? ` · ${review.responseDate}` : ""}: </span>
                      {review.responseText}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {review.sourceUrl ? (
                    <Button asChild variant="ghost" size="sm">
                      <a href={review.sourceUrl} target="_blank" rel="noreferrer">Open in Google <ExternalLink className="size-3.5" aria-hidden /></a>
                    </Button>
                  ) : null}
                  <Button
                    variant={review.responseState === "unanswered" ? "accent" : "outline"}
                    size="sm"
                    onClick={() => setActive(review)}
                  >
                    {review.responseState === "responded" ? "View response" : "Respond"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {visible.length > 0 ? (
          <div className="-mx-4 -mb-4 mt-4">
            <TablePagination
              page={current}
              pageCount={totalPages}
              totalItems={filtered.length}
              pageSize={REVIEWS_PAGE_SIZE}
              itemLabel="reviews"
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </Panel>

      <ResponseSheet review={active} data={data} onClose={() => setActive(null)} />
    </div>
  );
}

function SummaryBand({ data }: { data: GbpReviewsData }) {
  const { summary } = data;
  return (
    <section aria-labelledby="reviews-summary-title">
      <SectionHeader title="Review summary" description="Current review position for this profile" />
      <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
        <MetricCard accent="brand" label="Average rating" value={summary.averageRating?.toFixed(1) ?? "—"} caption={summary.averageRating === null ? "Rating unavailable" : "Across all reviews"} />
        <MetricCard accent="teal" label="Total reviews" value={summary.total?.toLocaleString() ?? "—"} caption={summary.total === null ? "Review count unavailable" : "Synchronized reviews"} />
        <MetricCard accent="red" label="Needs a reply" value={summary.unanswered?.toLocaleString() ?? "—"} caption={summary.unanswered === null ? "Reply status unavailable" : "Reviews without a response"} />
        <MetricCard accent="amber" label="Rating spread" value={summary.distribution.length === 0 ? "—" : `${summary.distribution.length} bands`} caption={summary.distribution.length === 0 ? "Distribution unavailable" : "Ratings with reviews"} />
      </div>
      {summary.distribution.length > 0 ? (
        <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-surface p-4 shadow-card">
          {[5, 4, 3, 2, 1].map((value) => {
            const entry = summary.distribution.find((item) => item.rating === value);
            const total = summary.total ?? summary.distribution.reduce((sum, item) => sum + item.count, 0);
            const count = entry?.count ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={value} className="flex items-center gap-3">
                <span className="w-10 text-xs tabular text-muted-foreground">{value} star</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right text-xs tabular text-muted-foreground">{count.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function ResponseSheet({ review, data, onClose }: { review: GbpReview | null; data: GbpReviewsData; onClose: () => void }) {
  const [draft, setDraft] = useState("");
  const [isDraftGenerated, setIsDraftGenerated] = useState(false);

  const capabilities = data.capabilities;
  const published = review?.responseText ?? null;
  const canEdit = published ? capabilities.canEditResponse : capabilities.canRespond;

  return (
    <Sheet
      open={review !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setDraft("");
          setIsDraftGenerated(false);
        }
      }}
    >
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        {review ? (
          <>
            <SheetHeader>
              <SheetTitle>{review.reviewer ?? "Reviewer unavailable"}</SheetTitle>
              <SheetDescription>{review.date ?? "Date unavailable"}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              <div className="flex items-center gap-2">
                <Rating value={review.rating} />
                <ResponseBadge review={review} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review</p>
                <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{review.text ?? "This review has no text."}</p>
              </div>

              {published ? (
                <div className="rounded-md border border-success/25 bg-success-surface p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-success">Published response{review.responseDate ? ` · ${review.responseDate}` : ""}</p>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{published}</p>
                </div>
              ) : null}

              {canEdit ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="review-response">{published ? "Edit response" : "Your response"}</Label>
                    {capabilities.canGenerateResponse ? (
                      <Button variant="outline" size="sm" onClick={() => setIsDraftGenerated(true)}>Generate response</Button>
                    ) : null}
                  </div>
                  {isDraftGenerated ? (
                    <StatusBadge tone="warning">Draft — not published</StatusBadge>
                  ) : null}
                  <Textarea
                    id="review-response"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={6}
                    placeholder="Write a response to this reviewer"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                    <Button size="sm" disabled={draft.trim() === ""}>Publish response</Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Publishing and editing responses is not available in the current product integration, so this review can only be read here.
                </p>
              )}

              {review.sourceUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={review.sourceUrl} target="_blank" rel="noreferrer">Open in Google <ExternalLink className="size-3.5" aria-hidden /></a>
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
