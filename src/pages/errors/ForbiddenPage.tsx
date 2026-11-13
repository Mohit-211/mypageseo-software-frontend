import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { AccessDeniedPanel } from "@/components/mypageseo/access";

/** `/403`: a page this account can't open, with the way back. */
function AccessDeniedRoute() {
  return (
    <>
      <PageHeader icon={ShieldAlert} tone="settings" title="Access denied" description="This part of MyPageSEO isn't available to your account." />
      <AccessDeniedPanel description="Your account doesn't have access to the page you tried to open. If you think that's wrong, ask the account owner to give you access." />
    </>
  );
}

export default AccessDeniedRoute;
