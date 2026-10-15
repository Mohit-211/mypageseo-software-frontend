import { Link } from "react-router-dom";
import { Link2 } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ReportsList } from "@/components/report/reports-list";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";

/** Every report of the organization, across locations. */
function ReportsPage() {
  const access = useAccess();
  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="Every report generated for your locations. Open one to view it, download the PDF, share a link or email it."
        actions={
          // White-label client links (Phase 23): agency owner and members.
          access.accountType === "agency" && access.can("clients.view") ? (
            <Button asChild variant="outline" size="sm"><Link to="/reports/client-links"><Link2 aria-hidden /> Client links</Link></Button>
          ) : undefined
        }
      />
      <ReportsList reportPath={(reportId) => `/reports/${reportId}`} />
    </AppShell>
  );
}

export default ReportsPage;
