import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ComingSoon } from "@/components/layout/shared/feedback/coming-soon";

function AutomationsCreatePage() {
  return (
    <AppShell>
      <PageHeader title="Automations" description="Rules that act on your ranking, review and profile changes for you." />
      <ComingSoon
        className="mt-6"
        title="Automations are on the way"
        description="Custom automation rules aren't available yet. Monthly refreshes, scheduled reports and GBP auto-posts already run on their own from their own pages."
      />
    </AppShell>
  );
}

export default AutomationsCreatePage;
