import { LocationSectionRedirect } from "@/pages/rankings/rankings-redirect";

/** The sidebar's GBP Overview opens the selected location's GBP page. */
function GbpIndexPage() {
  return <LocationSectionRedirect section="gbp" view="" title="GBP Overview" description="Google Business Profile performance for each location." />;
}

export default GbpIndexPage;
