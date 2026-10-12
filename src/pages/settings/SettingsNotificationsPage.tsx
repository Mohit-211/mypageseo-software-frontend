import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ComingSoon } from "@/components/layout/shared/feedback/coming-soon";
import { useWorkspace } from "@/lib/mypageseo/workspace";

function NotificationSettingsPage() {
  const workspace = useWorkspace();
  return (
    <AppShell>
      <PageHeader title="Notifications" description="Choose which MyPageSEO updates and alerts you receive." />
      <SettingsNav active="notifications" isAgency={workspace.organization?.accountType === "agency"} />
      <ComingSoon
        className="mt-6"
        title="Notification settings are on the way"
        description="Email and in-app alert preferences arrive with notifications. Nothing is sent today except account emails (verification, password reset, invitations) and scheduled reports."
      />
    </AppShell>
  );
}

export default NotificationSettingsPage;
