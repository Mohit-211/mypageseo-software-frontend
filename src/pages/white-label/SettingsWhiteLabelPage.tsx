import { Link } from "react-router-dom";
import { RequireAccess } from "@/components/mypageseo/access";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { WhiteLabelPage } from "@/components/white-label/white-label-page";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const SettingsWhiteLabelPage = () => (
  <RequireAccess permission="white_label.manage">
    <AppShell>
      <WhiteLabelGate />
    </AppShell>
  </RequireAccess>
);

/** White-label hosting is an agency feature; business accounts get an explanation instead. */
function WhiteLabelGate() {
  const workspace = useWorkspace();

  if (workspace.status === "loading") {
    return (
      <>
        <PageHeader title="White-Label" description="Loading your white-label configuration." />
        <div className="mt-6">
          <PageSkeleton />
        </div>
      </>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <>
        <PageHeader title="White-Label" description="Customize your client-facing reports with your agency's branding." />
        <ErrorState
          className="mt-6"
          description="We couldn't load your organization. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </>
    );
  }

  if (workspace.organization?.accountType !== "agency") {
    return (
      <>
        <PageHeader title="White-Label" description="White-label hosting is part of the Agency workspace." />
        <EmptyState
          className="mt-6"
          title="White-label hosting is only available to agency organizations"
          description="This organization is a business account, so reports are always presented with standard MyPageSEO branding."
          action={
            <Button asChild>
              <Link to="/settings">Back to settings</Link>
            </Button>
          }
        />
      </>
    );
  }

  return <WhiteLabelPage />;
}

export default SettingsWhiteLabelPage;
