import { Outlet, useOutletContext } from "react-router-dom";
import type { GbpContext } from "@/lib/gbp/gbp-context";

/** Passes the location on to the Audit and Competitors pages (each draws its own tabs). */
function GbpAuditLayout() {
  const context = useOutletContext<GbpContext>();
  return <Outlet context={context} />;
}

export default GbpAuditLayout;
