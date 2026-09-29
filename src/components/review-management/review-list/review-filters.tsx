import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ComparisonControl } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DATE_OPTIONS,
  PLATFORM_OPTIONS,
  RATING_OPTIONS,
  REPLY_OPTIONS,
  SENTIMENT_OPTIONS,
  STATUS_OPTIONS,
  TOPIC_OPTIONS,
  activeFilterChips,
  type ReplyFilter,
  type ReviewFilterState,
} from "./review-filter-model";

function FilterSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  stacked,
}: {
  id: string;
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Shows a visible label above the control (mobile drawer). */
  stacked?: boolean;
}) {
  const control = (
    <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled ?? false}>
      <SelectTrigger id={id} className="h-9 w-full bg-surface text-sm md:w-auto md:min-w-36" aria-label={stacked ? undefined : label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(options) as T[]).map((key) => (
          <SelectItem key={key} value={key}>
            {options[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  if (!stacked) return control;
  return (
    <div>
      <Label htmlFor={id} className="text-[13px] font-medium text-foreground">
        {label}
      </Label>
      <div className="mt-1.5">{control}</div>
    </div>
  );
}

const REPLY_SEGMENTS = (Object.keys(REPLY_OPTIONS) as ReplyFilter[]).map((value) => ({ value, label: REPLY_OPTIONS[value] }));

function FilterFields({
  filters,
  set,
  analyzed,
  stacked,
}: {
  filters: ReviewFilterState;
  set: <K extends keyof ReviewFilterState>(key: K, value: ReviewFilterState[K]) => void;
  analyzed: boolean;
  stacked?: boolean;
}) {
  const prefix = stacked ? "review-filter-sheet" : "review-filter";
  const flags = stacked ? { stacked: true } : {};
  return (
    <>
      <FilterSelect id={`${prefix}-rating`} label="Rating" value={filters.rating} options={RATING_OPTIONS} onChange={(v) => set("rating", v)} {...flags} />
      <FilterSelect id={`${prefix}-sentiment`} label="Sentiment" value={filters.sentiment} options={SENTIMENT_OPTIONS} onChange={(v) => set("sentiment", v)} disabled={!analyzed} {...flags} />
      <FilterSelect id={`${prefix}-topic`} label="Topic" value={filters.topic} options={TOPIC_OPTIONS} onChange={(v) => set("topic", v)} disabled={!analyzed} {...flags} />
      <FilterSelect id={`${prefix}-status`} label="Response Status" value={filters.status} options={STATUS_OPTIONS} onChange={(v) => set("status", v)} {...flags} />
      <FilterSelect id={`${prefix}-date`} label="Date" value={filters.date} options={DATE_OPTIONS} onChange={(v) => set("date", v)} {...flags} />
      <FilterSelect id={`${prefix}-platform`} label="Platform" value={filters.platform} options={PLATFORM_OPTIONS} onChange={(v) => set("platform", v)} {...flags} />
    </>
  );
}

export function ReviewFilters({
  filters,
  onChange,
  onClear,
  analyzed,
  resultCount,
}: {
  filters: ReviewFilterState;
  onChange: (filters: ReviewFilterState) => void;
  onClear: () => void;
  /** Sentiment and topic filters need AI analysis. */
  analyzed: boolean;
  resultCount: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const set = <K extends keyof ReviewFilterState>(key: K, value: ReviewFilterState[K]) => onChange({ ...filters, [key]: value });
  // The response segment is visible on every screen size, so the drawer badge counts the rest.
  const activeCount = activeFilterChips(filters).length;
  const drawerCount = activeCount - (filters.reply === "all" ? 0 : 1);
  const canClear = activeCount > 0 || filters.search.trim() !== "";

  return (
    <div className="space-y-3 border-b border-border bg-surface px-4 py-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <div className="flex gap-2 md:contents">
          <div className="relative min-w-0 flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Search customer or review..."
              aria-label="Search customer or review"
              className="h-9 pl-9 text-sm"
            />
          </div>
          {/* Mobile: filters move into a bottom drawer. */}
          <Button variant="outline" className="h-9 shrink-0 md:hidden" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal aria-hidden />
            Filters
            {drawerCount > 0 ? (
              <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{drawerCount}</span>
            ) : null}
          </Button>
        </div>
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <FilterFields filters={filters} set={set} analyzed={analyzed} />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-full overflow-x-auto">
          <ComparisonControl value={filters.reply} options={REPLY_SEGMENTS} onChange={(v) => set("reply", v)} ariaLabel="Response" />
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {resultCount.toLocaleString()} review{resultCount === 1 ? "" : "s"}
            {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? "" : "s"} active` : ""}
          </p>
          <Button variant="ghost" size="sm" className="text-xs" disabled={!canClear} onClick={onClear}>
            <X aria-hidden /> Clear Filters
          </Button>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-xl p-0">
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle className="text-base">Filter reviews</SheetTitle>
            <SheetDescription>{analyzed ? "Narrow down the review list." : "Sentiment and topic filters are available after AI analysis."}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
            <FilterFields filters={filters} set={set} analyzed={analyzed} stacked />
          </div>
          <SheetFooter className="sticky bottom-0 flex-row gap-2 border-t border-border bg-surface px-4 py-3">
            <Button variant="outline" className="flex-1" disabled={!canClear} onClick={onClear}>
              Clear Filters
            </Button>
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              Show {resultCount.toLocaleString()} review{resultCount === 1 ? "" : "s"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
