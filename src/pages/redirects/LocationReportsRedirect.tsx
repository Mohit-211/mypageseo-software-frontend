import { Navigate, useLocation } from "react-router-dom";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { useRequiredParams } from "@/hooks/use-required-params";
import { withSearchAndHash } from "@/lib/mypageseo/section-links";
import { useWhiteLabelAccess } from "@/lib/white-label/access";

/**
 * `/locations/:locationId/reports` (the old per-location Reports tab): agency staff manage the
 * location's client link and reports in White Label, everyone else sees its reports in Reports.
 * Which one depends on the role, so it waits for the workspace (inside the shell).
 */
export function LocationReportsRedirect() {
  const { locationId } = useRequiredParams("locationId");
  const { search } = useLocation();
  const access = useWhiteLabelAccess();

  if (!access.ready) return <PageSkeleton />;
  const location = encodeURIComponent(locationId);
  const to = access.canWhiteLabel ? `/white-label?location=${location}#links` : `/reports?location=${location}`;
  return (
    <>
      <Navigate to={withSearchAndHash(to, { search })} replace />
      <PageSkeleton />
    </>
  );
}
