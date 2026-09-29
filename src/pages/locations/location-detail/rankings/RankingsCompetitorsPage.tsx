import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { CompetitorRankingFilterBar, CompetitorRankingsTable, type CompetitorFilterValues } from "@/components/competitor/competitor-rankings";
import { PageHeader } from "@/components/layout/shared/data-display";
import { RankingsNavigation } from "@/components/location/location-workspace";
import { getCompetitorRankings, type CompetitorRankingOrder, type CompetitorRankingSort } from "@/lib/mypageseo/competitor-rankings";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { useRequiredParams } from "@/hooks/use-required-params";

const searchSchema = z.object({ q: z.string().optional(), competitor: z.string().optional(), group: z.string().optional(), date: z.string().optional(), comparison: z.string().optional(), resultType: z.string().optional(), focus: z.string().optional(), sort: z.string().optional(), order: z.string().optional(), page: z.coerce.number().optional() });



function CompetitorRankingsPage() {
  const { locationId } = useRequiredParams("locationId");
  const [search, setSearch] = useTypedSearch(searchSchema);
  const navigate = useNavigate();
  const data = getCompetitorRankings(locationId);
  const values: CompetitorFilterValues = { query: search.q ?? "", competitor: search.competitor ?? "all", group: search.group ?? "all", date: search.date ?? data.dates[0] ?? "", comparison: search.comparison ?? data.comparisonPeriods[0] ?? "", resultType: search.resultType ?? data.resultTypes[0] ?? "", focus: search.focus ?? "all" };
  const sort: CompetitorRankingSort = ["keyword", "location", "gap"].includes(search.sort ?? "") ? search.sort as CompetitorRankingSort : "keyword";
  const order: CompetitorRankingOrder = search.order === "desc" ? "desc" : "asc";
  const page = Math.max(1, search.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(data.total / 25));
  const resetFilters = () => setSearch({ q: undefined, competitor: undefined, group: undefined, date: search.date, comparison: search.comparison, resultType: search.resultType, focus: undefined, sort: search.sort, order: search.order, page: undefined });
  return <><RankingsNavigation locationId={locationId} activeView="competitors" /><PageHeader title="Competitor Rankings" description="Compare tracked keyword performance for this location against its tracked competitors." /><CompetitorRankingFilterBar data={data} values={values} onChange={(key, value) => setSearch((previous) => ({ ...previous, [key === "query" ? "q" : key]: value, page: undefined }))} onReset={resetFilters} /><CompetitorRankingsTable data={data} sort={sort} order={order} page={page} pageCount={pageCount} onSort={(nextSort) => setSearch((previous) => ({ ...previous, sort: nextSort, order: previous.sort === nextSort && previous.order !== "desc" ? "desc" : "asc", page: undefined }))} onPageChange={(nextPage) => setSearch((previous) => ({ ...previous, page: nextPage }))} onClearFilters={resetFilters} onRetry={() => setSearch((previous) => ({ ...previous }))} /></>;
}

export default CompetitorRankingsPage;
