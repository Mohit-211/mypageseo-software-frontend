import { PageHeader } from "@/components/mypageseo/data-display";
import { GbpNavigation } from "@/components/mypageseo/location-workspace";
import { GbpOverviewContent } from "@/components/mypageseo/gbp-overview";
import { getGbpOverview } from "@/lib/mypageseo/gbp-overview";
import { useRequiredParams } from "@/hooks/use-required-params";



function LocationGbpOverviewPage() {
  const { locationId } = useRequiredParams("locationId");
  const data = getGbpOverview(locationId);
  return (
    <>
      <GbpNavigation locationId={locationId} activeView="overview" />
      <PageHeader title="GBP Overview" description="Review the current health and key information of this location's Google Business Profile." />
      <GbpOverviewContent data={data} onRetry={() => window.location.reload()} />
    </>
  );
}

export default LocationGbpOverviewPage;
