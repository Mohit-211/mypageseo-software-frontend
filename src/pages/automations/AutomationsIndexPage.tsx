import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader } from "@/components/mypageseo/data-display";
import { AutomationsContent } from "@/components/mypageseo/automations";
import { getAutomations } from "@/lib/mypageseo/automations";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const DESCRIPTION =
  "Mypageseo runs supported recurring local SEO tasks for you — ranking and review alerts, citation monitoring, scheduled Google Business Profile posts and recurring report delivery.";



function AutomationsPage() {
  const workspace = useWorkspace();
  const accountType = workspace.organization?.accountType === "agency" ? "agency" : "business";
  const data = getAutomations(accountType, workspace.activeClient?.id ?? null);

  return (
    <AppShell>
      <PageHeader title="Automations" description={DESCRIPTION} />
      <AutomationsContent
        data={data}
        accountType={accountType}
        onRetry={() => window.location.reload()}
      />
    </AppShell>
  );
}

export default AutomationsPage;
