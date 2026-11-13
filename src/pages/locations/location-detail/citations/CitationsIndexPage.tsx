import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { CitationsContent, CitationsError, CitationsLoading, CitationsSettingUp } from "@/components/citation/citations";
import { ReportButton } from "@/components/report/rank-report-button";
import { useCitations } from "@/lib/citations/use-citations";
import { useLocationRoute } from "@/lib/locations/location-route-context";

/** One location's citations (the location itself is loaded by the location layout). */
function LocationCitationsPage() {
  const { location } = useLocationRoute();
  const citations = useCitations(location.location_id);
  const available = citations.data?.available === true;

  return (
    <>
      <PageHeader
        icon={ListChecks}
        tone="citations"
        title="Citations"
        description="Your listings on online directories, checked by hand by the MyPageSEO team: which are right, which show the wrong name, address or phone, and where you're missing."
        actions={
          available ? (
            <ReportButton locationId={location.location_id} type="citation" subtitle="Citation score, every listing, wrong details and recent changes, as a PDF." />
          ) : undefined
        }
      />
      {citations.isPending ? (
        <CitationsLoading />
      ) : citations.isError ? (
        <CitationsError onRetry={() => void citations.refetch()} />
      ) : citations.data.available ? (
        <CitationsContent data={citations.data} locationId={location.location_id} />
      ) : (
        <CitationsSettingUp />
      )}
    </>
  );
}

export default LocationCitationsPage;
