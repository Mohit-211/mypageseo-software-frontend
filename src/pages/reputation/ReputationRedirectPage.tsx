import { LocationSectionRedirect } from "@/pages/rankings/rankings-redirect";

/** The sidebar's Reputation → Reviews opens the selected location's reviews. */
export function ReputationReviewsRedirectPage() {
  return <LocationSectionRedirect section="reputation" view="" title="Reviews" description="Google reviews for each location." />;
}

/** The sidebar's Reputation → Insights opens the selected location's review insights. */
export function ReputationInsightsRedirectPage() {
  return <LocationSectionRedirect section="reputation" view="insights" title="Review insights" description="What customers say, per location." />;
}
