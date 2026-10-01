import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ReportsList } from "@/components/report/reports-list";

/** Every report of the organization, across locations. */
function ReportsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="Every report generated for your locations. Open one to view it, download the PDF, share a link or email it."
      />
      <ReportsList reportPath={(reportId) => `/reports/${reportId}`} />
    </AppShell>
  );
}

export default ReportsPage;
