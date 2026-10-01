import { Navigate } from "react-router-dom";
import { useRequiredParams } from "@/hooks/use-required-params";

/** Reviews moved to the location's Reputation section. */
function LocationGbpReviewsPage() {
  const { locationId } = useRequiredParams("locationId");
  return <Navigate to={`/locations/${locationId}/reputation`} replace />;
}

export default LocationGbpReviewsPage;
