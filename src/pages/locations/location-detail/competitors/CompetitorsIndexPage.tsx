import { Navigate } from "react-router-dom";
import { useRequiredParams } from "@/hooks/use-required-params";

/** Tracked competitors are compared on the ranking pages (ranks) and in the GBP report (public profiles). */
function CompetitorsIndexPage() {
  const { locationId } = useRequiredParams("locationId");
  return <Navigate to={`/locations/${locationId}/rankings/competitors`} replace />;
}

export default CompetitorsIndexPage;
