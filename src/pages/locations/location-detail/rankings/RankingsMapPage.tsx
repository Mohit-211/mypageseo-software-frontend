import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { PageHeader } from "@/components/layout/shared/data-display";
import { RankingsNavigation } from "@/components/location/location-workspace";
import { MapRankingContent, MapRankingFilterBar, type MapRankingFilters } from "@/components/ranking/map-rankings";
import { getMapRankings } from "@/lib/raking/map-rankings";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { useRequiredParams } from "@/hooks/use-required-params";

const searchSchema = z.object({
  keyword: z.string().optional(),
  context: z.string().optional(),
  resultType: z.string().optional(),
  date: z.string().optional(),
  compare: z.string().optional(),
});



function LocationMapRankingsPage() {
  const { locationId } = useRequiredParams("locationId");
  const [search, setSearch] = useTypedSearch(searchSchema);
  const navigate = useNavigate();
  const data = getMapRankings(locationId);
  const values: MapRankingFilters = {
    keyword: search.keyword ?? data.selectedKeyword?.id ?? "",
    searchContext: search.context ?? data.selectedSearchContext?.id ?? "",
    resultType: search.resultType ?? data.resultType ?? "",
    date: search.date ?? data.selectedDate ?? "",
    compare: search.compare ?? data.comparisonDate ?? "",
  };
  const updateFilter = (field: keyof MapRankingFilters, value: string) => {
    const key = field === "searchContext" ? "context" : field;
    setSearch((previous) => ({ ...previous, [key]: value || undefined }));
  };

  return (
    <>
      <RankingsNavigation locationId={locationId} activeView="map" />
      <PageHeader title="Map Rankings" description="See local ranking performance in Google Maps or Local Finder for a selected keyword and search context." />
      <MapRankingFilterBar data={data} values={values} onChange={updateFilter} />
      <MapRankingContent data={data} onRetry={() => setSearch((previous) => ({ ...previous }))} />
    </>
  );
}

export default LocationMapRankingsPage;
