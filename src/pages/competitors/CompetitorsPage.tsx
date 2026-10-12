import { LocationSectionRedirect } from "@/pages/rankings/rankings-redirect";

/** Opens the selected location's competitor rankings. */
function CompetitorsPage() {
  return <LocationSectionRedirect section="rankings" view="competitors" title="Competitors" description="How each location ranks against its tracked competitors." />;
}

export default CompetitorsPage;
