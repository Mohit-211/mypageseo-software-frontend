import { PageHeader } from "@/components/layout/shared/data-display";
import { GbpNavigation } from "@/components/location/location-workspace";
import { PostsPageContent } from "@/components/gbp-posts/posts-page";
import { useGbpContext } from "@/lib/gbp/gbp-context";

const description = "Write, schedule and publish Google Business Profile posts for this location. Posts made on Google show here too.";

function LocationGbpPostsPage() {
  const { location } = useGbpContext();
  return (
    <>
      <GbpNavigation locationId={location.location_id} activeView="posts" />
      <PageHeader title="Posts" description={description} />
      <PostsPageContent locationId={location.location_id} clientAssigned={location.client !== null} />
    </>
  );
}

export default LocationGbpPostsPage;
