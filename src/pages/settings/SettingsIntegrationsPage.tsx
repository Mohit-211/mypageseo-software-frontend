import { RequireAccess } from "@/components/mypageseo/access";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel } from "@/components/layout/shared/data-display";
import { SettingsNav } from "@/components/settings/settings-nav";
import { GoogleAccountsPanel } from "@/components/gbp-connect/google-accounts-panel";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/** Integrations: Google Business Profile accounts only (Google Analytics / Search Console are out of scope). */
const SettingsIntegrationsPage = () => (
  <RequireAccess permission="integrations.manage">
    <IntegrationsSettingsPage />
  </RequireAccess>
);

function IntegrationsSettingsPage() {
  const workspace = useWorkspace();
  return (
    <AppShell>
      <PageHeader title="Integrations" description="The Google accounts that manage your Business Profiles (up to 3 per user)." />
      <SettingsNav active="integrations" isAgency={workspace.organization?.accountType === "agency"} />
      <GoogleAccountsPanel />
      <Panel title="Other services">
        <p className="text-sm text-muted-foreground">
          MyPageSEO covers Google Maps and Google Business Profile visibility. Google Analytics and Search Console aren't part of it.
        </p>
      </Panel>
    </AppShell>
  );
}

export default SettingsIntegrationsPage;
