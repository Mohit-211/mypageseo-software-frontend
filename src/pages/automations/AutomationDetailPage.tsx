import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { AutomationBackLink, AutomationForm } from "@/components/automation/automation-form";
import {
  AUTOMATION_TYPE_LABEL,
  formFromAutomation,
  getAutomationDetail,
} from "@/lib/mypageseo/automations";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useRequiredParams } from "@/hooks/use-required-params";

const DESCRIPTION =
  "Review and update a configured automation, check its recent executions and pause, resume or run it now.";



function EditAutomationPage() {
  const { automationId } = useRequiredParams("automationId");
  const workspace = useWorkspace();
  const accountType = workspace.organization?.accountType === "agency" ? "agency" : "business";
  const detail = getAutomationDetail(automationId, accountType, workspace.activeClient?.id ?? null);

  return (
    <AppShell>
      <div className="mb-4">
        <AutomationBackLink />
      </div>
      <PageHeader
        title="Edit Automation"
        description={
          detail.automation
            ? `${AUTOMATION_TYPE_LABEL[detail.automation.type]} · ${detail.automation.locationName ?? "No location"}`
            : DESCRIPTION
        }
      />
      {detail.status === "loading" ? (
        <TableSkeleton rows={6} columns={2} />
      ) : detail.status === "error" ? (
        <ErrorState
          description="This automation could not be loaded. Try again in a moment."
          onRetry={() => window.location.reload()}
        />
      ) : detail.status === "not_found" || !detail.automation ? (
        <EmptyState
          title="Automation not found"
          description="This automation no longer exists, or it belongs to a client you do not have access to."
        />
      ) : !detail.capabilities.canEdit ? (
        <EmptyState
          title="Editing is not available"
          description="Your current access allows viewing this automation only. Ask an organization administrator to make changes."
        />
      ) : (
        <AutomationForm
          mode="edit"
          initialValues={formFromAutomation(detail.automation)}
          automation={detail.automation}
          capabilities={detail.capabilities}
          accountType={accountType}
          clients={workspace.clients}
          locations={workspace.locations}
        />
      )}
    </AppShell>
  );
}

export default EditAutomationPage;
