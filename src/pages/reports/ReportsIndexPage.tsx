import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ReportsContent } from "@/components/location_component/location_reports/reports";
import { ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { getReports } from "@/lib/mypageseo/reports";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const description =
  "Mypageseo reports bring local SEO performance, Google Business Profile health, competitors, rankings and citations together in one consolidated document.";



function ReportsPage() {
  const workspace = useWorkspace();
  const data = getReports();
  const isAgency = workspace.organization?.accountType === "agency";

  if (workspace.status === "loading") {
    return <AppShell><div role="status" aria-live="polite" className="h-64 animate-pulse rounded-lg bg-muted" aria-label="Loading reports workspace" /></AppShell>;
  }
  if (workspace.status === "unavailable") {
    return (
      <AppShell>
        <ErrorState description="We couldn't load your reporting workspace. Try again without leaving this page." onRetry={() => window.location.reload()} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description={description}
        actions={<Button asChild size="sm"><Link to="/reports/create">Create report</Link></Button>}
      />
      <ReportsContent data={data} isAgency={isAgency} onRetry={() => window.location.reload()} />
    </AppShell>
  );
}

export default ReportsPage;
