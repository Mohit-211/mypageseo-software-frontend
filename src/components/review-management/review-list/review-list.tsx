import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/layout/shared/data-display";
import { ActiveFilterChips, TableCard, TablePagination, type SortOrder } from "@/components/layout/shared/data-table";
import { NoResultsEmpty } from "@/components/layout/shared/feedback/empty-states";
import { FilterBarSkeleton, TableSkeleton } from "@/components/layout/shared/feedback/states";
import type { Review } from "@/lib/reviews/review-management";
import { AllCaughtUpEmpty } from "../empty-states";
import { ReviewCard } from "./review-card";
import { DEFAULT_REVIEW_FILTERS, activeFilterChips, matchesReviewFilters, type ReviewFilterState } from "./review-filter-model";
import { ReviewFilters } from "./review-filters";
import type { ReviewRowHandlers } from "./review-row-model";
import { ReviewTable, type ReviewSortKey } from "./review-table";

const PAGE_SIZE = 10;

export const REVIEW_LIST_ID = "review-list";

export function ReviewList({
  reviews,
  analyzed,
  filters,
  onFiltersChange,
  handlers,
}: {
  reviews: Review[];
  analyzed: boolean;
  filters: ReviewFilterState;
  onFiltersChange: (filters: ReviewFilterState) => void;
  handlers: ReviewRowHandlers;
}) {
  const [sort, setSort] = useState<ReviewSortKey>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  // Date filters are relative to when the list was opened.
  const [now] = useState(() => Date.now());

  const rows = useMemo(() => {
    const dir = order === "asc" ? 1 : -1;
    return reviews
      .filter((r) => matchesReviewFilters(r, filters, now))
      .sort((a, b) =>
        sort === "rating"
          ? (a.rating - b.rating) * dir || b.createdAt.localeCompare(a.createdAt)
          : a.createdAt.localeCompare(b.createdAt) * dir,
      );
  }, [reviews, filters, sort, order, now]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const changeFilters = (next: ReviewFilterState) => {
    onFiltersChange(next);
    setPage(1);
  };
  const clear = () => changeFilters(DEFAULT_REVIEW_FILTERS);

  // "Needs Response" with nothing left is good news, not a failed search.
  const caughtUp =
    rows.length === 0 && filters.reply === "needs_response" && activeFilterChips(filters).length === 1 && filters.search.trim() === "";

  return (
    <section id={REVIEW_LIST_ID} aria-label="Reviews" className="scroll-mt-20">
      <SectionHeader title="Reviews" description="Search, filter and respond to individual reviews." />
      <TableCard>
        <ReviewFilters filters={filters} onChange={changeFilters} onClear={clear} analyzed={analyzed} resultCount={rows.length} />
        <ActiveFilterChips filters={activeFilterChips(filters)} />
        {rows.length === 0 ? (
          <div className="p-4">{caughtUp ? <AllCaughtUpEmpty /> : <NoResultsEmpty label="reviews" onClear={clear} />}</div>
        ) : (
          <>
            <div className="hidden md:block">
              <ReviewTable
                reviews={visible}
                sort={sort}
                order={order}
                onSort={(key) => {
                  if (sort === key) setOrder((o) => (o === "asc" ? "desc" : "asc"));
                  else {
                    setSort(key);
                    setOrder("desc");
                  }
                  setPage(1);
                }}
                handlers={handlers}
              />
            </div>
            <ul className="divide-y divide-border md:hidden" aria-label="Reviews">
              {visible.map((review) => (
                <li key={review.id}>
                  <ReviewCard review={review} handlers={handlers} />
                </li>
              ))}
            </ul>
            <TablePagination page={safePage} pageCount={pageCount} totalItems={rows.length} pageSize={PAGE_SIZE} itemLabel="reviews" onPageChange={setPage} />
          </>
        )}
      </TableCard>
    </section>
  );
}

export function ReviewListSkeleton() {
  return (
    <div className="space-y-3">
      <FilterBarSkeleton fields={4} />
      <TableSkeleton rows={6} columns={8} />
    </div>
  );
}
