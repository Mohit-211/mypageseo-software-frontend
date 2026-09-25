import { Link } from "react-router-dom";
import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader } from "@/components/mypageseo/data-display";
import { ReportSchedulesContent } from "@/components/mypageseo/report-schedules";
import { ErrorState } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import { getReportSchedules } from "@/lib/mypageseo/reports";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const description =
  "Manage recurring Mypageseo report generation and delivery, including what each schedule covers, when it next runs and its current status.";



function ScheduledReportsPage() {
  const workspace = useWorkspace();
  const data = getReportSchedules();
  const isAgency = workspace.organization?.accountType === "agency";

  if (workspace.status === "loading") {
    return (
      <AppShell>
        <div role="status" aria-live="polite" className="h-64 animate-pulse rounded-lg bg-muted" aria-label="Loading scheduled reports" />
      </AppShell>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <AppShell>
        <ErrorState
          description="We couldn't load your reporting workspace. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Scheduled Reports"
        description={description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/reports">Back to reports</Link>
            </Button>
            {data.capabilities.canCreate ? <Button size="sm">Schedule report</Button> : null}
          </div>
        }
      />
      <ReportSchedulesContent data={data} isAgency={isAgency} onRetry={() => window.location.reload()} />
    </AppShell>
  );
}

export default ScheduledReportsPage;
