import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ReportSchedulesContent, ScheduleReportDialog } from "@/components/report/report-schedules";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";

/** Monthly report schedules (`/report-schedules`). */
function ScheduledReportsPage() {
  const canEdit = useCanEdit();
  const [creating, setCreating] = useState(false);
  return (
    <AppShell>
      <PageHeader
        title="Scheduled Reports"
        description="Reports emailed every month, right after each location's automatic monthly refresh."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/reports">Back to reports</Link></Button>
            {canEdit ? <Button size="sm" onClick={() => setCreating(true)}><Plus aria-hidden /> Schedule report</Button> : null}
          </div>
        }
      />
      <ReportSchedulesContent onCreate={() => setCreating(true)} />
      {creating ? <ScheduleReportDialog onClose={() => setCreating(false)} /> : null}
    </AppShell>
  );
}

export default ScheduledReportsPage;
