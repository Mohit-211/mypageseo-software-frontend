import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { AccessDeniedPanel } from "@/components/mypageseo/access";

const description = "This part of Mypageseo is not available to your account.";



function AccessDeniedRoute() {
  return (
    <AppShell>
      <PageHeader title="Access denied" description={description} />
      <AccessDeniedPanel description="Your account does not have access to the page you tried to open. If you think that is wrong, someone who administers this organization can grant access." />
    </AppShell>
  );
}

export default AccessDeniedRoute;
