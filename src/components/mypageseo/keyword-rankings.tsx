import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { StatusBadge } from "@/components/layout/shared/data-display";
import type { KeywordRankingRow, KeywordRankingsData, KeywordSort, SortOrder } from "@/lib/mypageseo/keyword-rankings";
import { cn } from "@/lib/utils";
import { NoKeywordsEmpty, NoRankingDataEmpty, NoResultsEmpty } from "@/components/layout/shared/feedback/empty-states";

export type KeywordFilterValues = {
  query: string;
  group: string;
  resultType: string;
  period: string;
  comparison: string;
  top: string;
  movement: string;
};

export function KeywordFilterBar({ values, disabled, onChange, onReset }: { values: KeywordFilterValues; disabled: boolean; onChange: (key: keyof KeywordFilterValues, value: string) => void; onReset: () => void }) {
  const hasFilters = Object.values(values).some((value) => value !== "" && value !== "all" && value !== "30_days" && value !== "previous");
  return (
    <section aria-label="Keyword filters" className="rounded-lg border border-border bg-surface p-3 shadow-card">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(140px,auto))_auto]">
        <label className="relative min-w-0">
          <span className="sr-only">Search keywords</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input value={values.query} onChange={(event) => onChange("query", event.target.value)} placeholder="Search keywords" disabled={disabled} className="bg-background pl-9" />
        </label>
        <FilterSelect label="Keyword group" value={values.group} disabled={disabled} onChange={(value) => onChange("group", value)} options={[{ value: "all", label: "All groups" }]} />
        <FilterSelect label="Result type" value={values.resultType} disabled={disabled} onChange={(value) => onChange("resultType", value)} options={[{ value: "all", label: "All result types" }, { value: "google", label: "Google" }, { value: "local_finder", label: "Local Finder" }]} />
        <FilterSelect label="Movement" value={values.movement} disabled={disabled} onChange={(value) => onChange("movement", value)} options={[{ value: "all", label: "All movement" }, { value: "improved", label: "Improved" }, { value: "declined", label: "Declined" }, { value: "unchanged", label: "Unchanged" }]} />
        <Button type="button" variant="ghost" size="sm" disabled={disabled || !hasFilters} onClick={onReset}><RotateCcw aria-hidden /> Reset</Button>
      </div>
      <div className="mt-2 grid gap-2 border-t border-border pt-2 sm:grid-cols-3 lg:max-w-[560px]">
        <FilterSelect label="Ranking period" value={values.period} disabled={disabled} onChange={(value) => onChange("period", value)} options={[{ value: "30_days", label: "Last 30 days" }]} />
        <FilterSelect label="Comparison period" value={values.comparison} disabled={disabled} onChange={(value) => onChange("comparison", value)} options={[{ value: "previous", label: "Previous period" }]} />
        <FilterSelect label="Top positions" value={values.top} disabled={disabled} onChange={(value) => onChange("top", value)} options={[{ value: "all", label: "All positions" }, { value: "3", label: "Top 3" }, { value: "10", label: "Top 10" }, { value: "20", label: "Top 20" }]} />
      </div>
      {disabled ? <p className="mt-2 text-xs text-muted-foreground">Filters become available when tracked keyword data is connected.</p> : null}
    </section>
  );
}

function FilterSelect({ label, value, disabled, onChange, options }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full bg-background"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function KeywordRankingsTable({ data, sort, order, page, pageCount, onSort, onPageChange, onClearFilters, onRetry }: { data: KeywordRankingsData; sort: KeywordSort; order: SortOrder; page: number; pageCount: number; onSort: (sort: KeywordSort) => void; onPageChange: (page: number) => void; onClearFilters: () => void; onRetry: () => void }) {
  if (data.status === "loading") return <TableSkeleton rows={8} columns={6} />;
  if (data.status === "error") return <ErrorState title="Keyword rankings could not be loaded" description="The location workspace is still available. Retry this table without leaving the page." onRetry={onRetry} />;

  return (
    <section aria-labelledby="keyword-table-title" className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0"><h2 id="keyword-table-title" className="text-sm font-semibold text-foreground">Tracked keywords</h2><p className="mt-0.5 text-xs text-muted-foreground">{data.total.toLocaleString()} keywords</p></div>
        {data.comparisonLabel ? <span className="shrink-0 text-xs text-muted-foreground">Compared with {data.comparisonLabel}</span> : null}
      </div>
      <div role="region" aria-label="Keyword rankings" tabIndex={0} className="data-grid-scroll overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        <table className="w-full min-w-[780px] border-collapse text-left text-sm">
          <thead className="bg-surface-strong">
            <tr className="border-b border-border">
              <SortableHeader label="Keyword" value="keyword" active={sort} order={order} onSort={onSort} disabled={data.status !== "ready"} className="min-w-[280px]" />
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Group</th>
              <SortableHeader label="Current position" value="current" active={sort} order={order} onSort={onSort} disabled={data.status !== "ready"} />
              <SortableHeader label="Previous position" value="previous" active={sort} order={order} onSort={onSort} disabled={data.status !== "ready"} />
              <SortableHeader label="Movement" value="movement" active={sort} order={order} onSort={onSort} disabled={data.status !== "ready"} />
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Result type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.rows.map((row) => <KeywordRow key={row.id} row={row} />)}
            {data.status === "no_keywords" ? <tr><td colSpan={6} className="p-4"><NoKeywordsEmpty className="border-0 py-14 shadow-none" /></td></tr> : null}
            {data.status === "no_data" ? <tr><td colSpan={6} className="p-4"><NoRankingDataEmpty className="border-0 py-14 shadow-none" /></td></tr> : null}
            {data.status === "ready" && data.rows.length === 0 ? <tr><td colSpan={6} className="p-4"><NoResultsEmpty label="keywords" onClear={onClearFilters} className="border-0 py-14 shadow-none" /></td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border bg-surface-strong px-4 py-3">
        <p className="min-w-0 truncate text-xs text-muted-foreground">Page {page} of {pageCount}</p>
        <div className="flex shrink-0 items-center gap-1"><Button variant="outline" size="icon" className="size-8" disabled={page <= 1 || data.status !== "ready"} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><ChevronLeft aria-hidden /></Button><Button variant="outline" size="icon" className="size-8" disabled={page >= pageCount || data.status !== "ready"} onClick={() => onPageChange(page + 1)} aria-label="Next page"><ChevronRight aria-hidden /></Button></div>
      </div>
    </section>
  );
}

function SortableHeader({ label, value, active, order, onSort, disabled, className }: { label: string; value: KeywordSort; active: KeywordSort; order: SortOrder; onSort: (value: KeywordSort) => void; disabled?: boolean; className?: string }) {
  const Icon = order === "asc" ? ArrowUp : ArrowDown;
  return <th className={cn("px-4 py-3", className)}><Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onSort(value)} className="-ml-3 h-7 px-3 text-xs font-medium text-muted-foreground hover:text-foreground">{label}{active === value ? <Icon className="size-3" aria-hidden /> : null}</Button></th>;
}

function KeywordRow({ row }: { row: KeywordRankingRow }) {
  return <tr className="hover:bg-muted/35"><td className="px-4 py-3 font-medium text-foreground">{row.keyword}</td><td className="px-4 py-3 text-muted-foreground">{row.group ?? "—"}</td><td className="px-4 py-3 font-semibold tabular text-foreground">{row.currentPosition ?? "—"}</td><td className="px-4 py-3 tabular text-muted-foreground">{row.previousPosition ?? "—"}</td><td className="px-4 py-3"><MovementBadge row={row} /></td><td className="px-4 py-3 text-muted-foreground">{row.resultType === "local_finder" ? "Local Finder" : "Google"}</td></tr>;
}

function MovementBadge({ row }: { row: KeywordRankingRow }) {
  if (!row.comparisonAvailable) return <span className="text-xs text-muted-foreground">No comparison</span>;
  if (row.movementStatus === "unchanged" || row.movement === 0) return <StatusBadge>Unchanged</StatusBadge>;
  const improved = row.movementStatus === "improved";
  return <StatusBadge tone={improved ? "success" : "critical"}>{improved ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}{improved ? "Improved" : "Declined"} {Math.abs(row.movement ?? 0)}</StatusBadge>;
}