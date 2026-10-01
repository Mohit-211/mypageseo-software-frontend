import { LocationSectionRedirect } from "@/pages/rankings/rankings-redirect";

/** The sidebar's GBP Audit opens the selected location's audit. */
function GbpAuditPage() {
  return <LocationSectionRedirect section="gbp" view="audit" title="GBP Audit" description="The GBP Score and checks for each location." />;
}

export default GbpAuditPage;
