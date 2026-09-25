import { PageHeader } from "@/components/layout/shared/data-display";
import { GbpNavigation } from "@/components/location_component/location-workspace";
import { GbpPostsContent } from "@/components/gbp-audit/gbp-posts";
import { getGbpPosts } from "@/lib/mypageseo/gbp-posts";
import { useRequiredParams } from "@/hooks/use-required-params";

const description = "Create, schedule, publish, and manage Google Business Profile posts for this location.";



function LocationGbpPostsPage() {
  const { locationId } = useRequiredParams("locationId");
  const data = getGbpPosts(locationId);
  return (
    <>
      <GbpNavigation locationId={locationId} activeView="posts" />
      <PageHeader
        title="GBP Posts"
        description={description}
        meta={data.lastCheckedAt ? <p className="text-xs text-muted-foreground">Last checked {data.lastCheckedAt}</p> : undefined}
      />
      <GbpPostsContent data={data} onRetry={() => window.location.reload()} />
    </>
  );
}

export default LocationGbpPostsPage;
