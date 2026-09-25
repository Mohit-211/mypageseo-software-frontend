import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader } from "@/components/mypageseo/data-display";
import { EmptyState } from "@/components/mypageseo/states";
import { AutomationBackLink, AutomationForm } from "@/components/mypageseo/automation-form";
import { emptyAutomationForm, getAutomations } from "@/lib/mypageseo/automations";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const DESCRIPTION =
  "Configure a supported recurring or event-based local SEO task, choose where it runs and review a plain-language summary before saving.";



function CreateAutomationPage() {
  const workspace = useWorkspace();
  const accountType = workspace.organization?.accountType === "agency" ? "agency" : "business";
  const { capabilities } = getAutomations(accountType, workspace.activeClient?.id ?? null);

  const initial = emptyAutomationForm();
  if (accountType === "agency" && workspace.activeClient) initial.clientId = workspace.activeClient.id;
  if (accountType === "business" && workspace.activeLocation) initial.locationId = workspace.activeLocation.id;

  return (
    <AppShell>
      <div className="mb-4">
        <AutomationBackLink />
      </div>
      <PageHeader title="Create Automation" description={DESCRIPTION} />
      {capabilities.canCreate ? (
        <AutomationForm
          mode="create"
          initialValues={initial}
          capabilities={capabilities}
          accountType={accountType}
          clients={workspace.clients}
          locations={workspace.locations}
        />
      ) : (
        <EmptyState
          title="Creating automations is not available"
          description="Your current access does not allow creating automations. Ask an organization administrator to create it for you."
        />
      )}
    </AppShell>
  );
}

export default CreateAutomationPage;
