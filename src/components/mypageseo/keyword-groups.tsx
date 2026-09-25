import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, TrendIndicator } from "@/components/mypageseo/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/mypageseo/states";
import type { KeywordGroupRow, KeywordGroupsData } from "@/lib/mypageseo/keyword-groups";

export function KeywordGroupSearch({ value, disabled, onChange, onReset }: { value: string; disabled: boolean; onChange: (value: string) => void; onReset: () => void }) {
  return (
    <section aria-label="Keyword group filters" className="rounded-lg border border-border bg-surface p-3 shadow-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">Search keyword groups</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input value={value} maxLength={100} onChange={(event) => onChange(event.target.value)} placeholder="Search groups" disabled={disabled} className="bg-background pl-9" />
        </label>
        <Button type="button" variant="ghost" size="sm" disabled={disabled || value.length === 0} onClick={onReset} className="self-start sm:self-auto">
          <RotateCcw aria-hidden /> Reset
        </Button>
      </div>
      {disabled ? <p className="mt-2 text-xs text-muted-foreground">Search becomes available when keyword groups are connected.</p> : null}
    </section>
  );
}

export function KeywordGroupsTable({ data, query, onClearSearch, onRetry }: { data: KeywordGroupsData; query: string; onClearSearch: () => void; onRetry: () => void }) {
  if (data.status === "loading") return <TableSkeleton rows={6} columns={6} />;
  if (data.status === "error") return <ErrorState title="Keyword groups could not be loaded" description="The Rankings workspace is still available. Retry this list without leaving the page." onRetry={onRetry} />;

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const rows = normalizedQuery ? data.rows.filter((row) => row.name.toLocaleLowerCase().includes(normalizedQuery)) : data.rows;

  return (
    <section aria-labelledby="keyword-groups-title" className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-4 py-3">
        <h2 id="keyword-groups-title" className="text-sm font-semibold text-foreground">Groups</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{data.total.toLocaleString()} keyword groups</p>
      </div>
      <div className="data-grid-scroll overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="bg-surface-strong">
            <tr className="border-b border-border">
              <th className="min-w-[260px] px-4 py-3 text-xs font-medium text-muted-foreground">Group name</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Keywords</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Average position</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Local Pack coverage</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Movement</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Tracking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => <KeywordGroupTableRow key={row.id} row={row} />)}
          </tbody>
        </table>
      </div>
      {data.status === "no_groups" ? (
        <div className="p-4"><EmptyState title="Organize tracked keywords into groups" description="This location has no keyword groups. Groups can organize search terms by service, product, location, or theme once keyword-group management is connected." className="border-0 py-14 shadow-none" /></div>
      ) : null}
      {data.status === "ready" && rows.length === 0 ? (
        <div className="p-4"><EmptyState title="No groups match this search" description="Clear the search to return to the complete group list." action={<Button variant="outline" size="sm" onClick={onClearSearch}>Clear search</Button>} className="border-0 py-14 shadow-none" /></div>
      ) : null}
    </section>
  );
}

function KeywordGroupTableRow({ row }: { row: KeywordGroupRow }) {
  return (
    <tr className="hover:bg-muted/35">
      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
      <td className="px-4 py-3 tabular text-foreground">{row.keywordCount.toLocaleString()}</td>
      <td className="px-4 py-3 tabular text-foreground">{row.averagePosition?.toFixed(1) ?? "—"}</td>
      <td className="px-4 py-3 tabular text-foreground">{row.localPackCoverage === null ? "—" : `${row.localPackCoverage}%`}</td>
      <td className="px-4 py-3"><GroupMovement row={row} /></td>
      <td className="px-4 py-3">{row.updatedAt ? <span className="text-xs text-muted-foreground">Updated {row.updatedAt}</span> : <StatusBadge>Awaiting data</StatusBadge>}</td>
    </tr>
  );
}

function GroupMovement({ row }: { row: KeywordGroupRow }) {
  if (row.movementStatus === "unavailable" || row.movement === null) return <span className="text-xs text-muted-foreground">No comparison</span>;
  if (row.movementStatus === "unchanged" || row.movement === 0) return <StatusBadge>Unchanged</StatusBadge>;
  const improved = row.movementStatus === "improved";
  return <TrendIndicator direction={improved ? "up" : "down"} positive={improved} value={`${improved ? "Improved" : "Declined"} ${Math.abs(row.movement)}`} className="whitespace-nowrap" />;
}