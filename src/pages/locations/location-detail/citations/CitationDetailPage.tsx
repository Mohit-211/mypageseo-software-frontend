import { Navigate } from "react-router-dom";
import { useRequiredParams } from "@/hooks/use-required-params";

/** Every listing's details are on the Citations page itself; old detail links land there. */
function CitationDetailPage() {
  const { locationId } = useRequiredParams("locationId", "citationId");
  return <Navigate to={`/locations/${locationId}/citations`} replace />;
}

export default CitationDetailPage;
