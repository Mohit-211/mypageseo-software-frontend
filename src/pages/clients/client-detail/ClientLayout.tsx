import { Outlet } from "react-router-dom";
import { RequireAccess } from "@/components/mypageseo/access";

const ClientLayoutRoute = () => (
    <RequireAccess permission="clients.view">
      <ClientLayout />
    </RequireAccess>
  );

function ClientLayout() {
  return <Outlet />;
}

export default ClientLayoutRoute;
