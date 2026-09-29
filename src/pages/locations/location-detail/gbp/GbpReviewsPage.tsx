import { PageHeader } from "@/components/layout/shared/data-display";
import { GbpNavigation } from "@/components/location/location-workspace";
import { GbpReviewsContent } from "@/components/gbp-audit/gbp-reviews";
import { getGbpReviews } from "@/lib/gbp/gbp-reviews";
import { useRequiredParams } from "@/hooks/use-required-params";

const description = "Monitor customer reviews, spot reviews awaiting a reply, and manage responses for this location.";



function LocationGbpReviewsPage() {
  const { locationId } = useRequiredParams("locationId");
  const data = getGbpReviews(locationId);
  return (
    <>
      <GbpNavigation locationId={locationId} activeView="reviews" />
      <PageHeader
        title="GBP Reviews"
        description={description}
        meta={data.lastCheckedAt ? <p className="text-xs text-muted-foreground">Last checked {data.lastCheckedAt}</p> : undefined}
      />
      <GbpReviewsContent data={data} onRetry={() => window.location.reload()} />
    </>
  );
}

export default LocationGbpReviewsPage;
