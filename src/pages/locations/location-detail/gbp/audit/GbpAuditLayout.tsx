import { Outlet } from "react-router-dom";
import { GbpNavigation } from "@/components/location/location-workspace";
import { useRequiredParams } from "@/hooks/use-required-params";



function GbpAuditLayout() {
  const { locationId } = useRequiredParams("locationId");
  return <><GbpNavigation locationId={locationId} activeView="audit" /><Outlet /></>;
}

export default GbpAuditLayout;
