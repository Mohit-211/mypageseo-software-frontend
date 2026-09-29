import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { KeywordFilterBar, KeywordRankingsTable, type KeywordFilterValues } from "@/components/ranking/keyword-rankings";
import { RankingsNavigation } from "@/components/location/location-workspace";
import { PageHeader } from "@/components/layout/shared/data-display";
import { getKeywordRankings, type KeywordSort, type SortOrder } from "@/lib/raking/keyword-rankings";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { useRequiredParams } from "@/hooks/use-required-params";

const searchSchema = z.object({
  q: z.string().optional(), group: z.string().optional(), resultType: z.string().optional(), period: z.string().optional(), comparison: z.string().optional(), top: z.string().optional(), movement: z.string().optional(), sort: z.string().optional(), order: z.string().optional(), page: z.coerce.number().optional(),
});



function LocationKeywordsPage() {
  const { locationId } = useRequiredParams("locationId");
  const [search, setSearch] = useTypedSearch(searchSchema);
  const navigate = useNavigate();
  const data = getKeywordRankings(locationId);
  const values: KeywordFilterValues = { query: search.q ?? "", group: search.group ?? "all", resultType: search.resultType ?? "all", period: search.period ?? "30_days", comparison: search.comparison ?? "previous", top: search.top ?? "all", movement: search.movement ?? "all" };
  const sort: KeywordSort = ["keyword", "current", "previous", "movement"].includes(search.sort ?? "") ? search.sort as KeywordSort : "keyword";
  const order: SortOrder = search.order === "desc" ? "desc" : "asc";
  const page = Math.max(1, search.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(data.total / 25));
  const resetFilters = () => setSearch({ q: undefined, group: undefined, resultType: undefined, period: undefined, comparison: undefined, top: undefined, movement: undefined, sort: search.sort, order: search.order, page: undefined });

  return (
    <>
      <RankingsNavigation locationId={locationId} activeView="keywords" />
      <PageHeader title="Keywords" description="Inspect the tracked search terms used to measure local ranking performance for this location." />
      <KeywordFilterBar values={values} disabled={data.status !== "ready"} onChange={(key, value) => setSearch((previous) => ({ ...previous, [key === "query" ? "q" : key]: value, page: undefined }))} onReset={resetFilters} />
      <KeywordRankingsTable data={data} sort={sort} order={order} page={page} pageCount={pageCount} onSort={(nextSort) => setSearch((previous) => ({ ...previous, sort: nextSort, order: previous.sort === nextSort && previous.order !== "desc" ? "desc" : "asc", page: undefined }))} onPageChange={(nextPage) => setSearch((previous) => ({ ...previous, page: nextPage }))} onClearFilters={resetFilters} onRetry={() => setSearch((previous) => ({ ...previous }))} />
    </>
  );
}

export default LocationKeywordsPage;
