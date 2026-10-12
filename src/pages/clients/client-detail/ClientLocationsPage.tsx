import { Navigate } from "react-router-dom";
import { useRequiredParams } from "@/hooks/use-required-params";

/** Locations, users, reports and schedules are all on the client's page. */
function ClientLocationsPage() {
  const { clientId } = useRequiredParams("clientId");
  return <Navigate to={`/clients/${clientId}`} replace />;
}

export default ClientLocationsPage;
