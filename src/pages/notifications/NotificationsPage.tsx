import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ComingSoon } from "@/components/layout/shared/feedback/coming-soon";

function NotificationsPage() {
  return (
    <AppShell>
      <PageHeader title="Notifications" description="Important updates and alerts from your MyPageSEO account." />
      <ComingSoon
        className="mt-6"
        title="Notifications are on the way"
        description="In-app and email alerts (ranking drops, new reviews, posts waiting for approval) aren't available yet. Until then, the dashboard's recommended actions list what needs attention."
      />
    </AppShell>
  );
}

export default NotificationsPage;
