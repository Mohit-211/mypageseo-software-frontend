import { CalendarClock, FileBarChart, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepHeading } from "@/components/white-label/step-heading";
import { useCanEdit } from "@/hooks/use-access";
import { useWriteBlock } from "@/lib/white-label/write-block";
import { ReportSchedulesContent, ScheduleReportDialog } from "./report-schedules";
import { ReportsList } from "./reports-list";

/**
 * PDF reports (`#reports`) and monthly emails (`#schedules`), shared by White Label (step 3) and
 * Reports. `clientId` / `locationId` narrow both lists; the create dialogs are opened by the page
 * (header buttons, `?create=report|schedule`).
 */
export function ReportsSection({
  step,
  clientId,
  locationId,
  createReportOpen,
  onCreateReportOpenChange,
  createScheduleOpen,
  onCreateScheduleOpenChange,
  showCreateReport = true,
  showScheduleButton = true,
}: {
  step?: number;
  clientId?: string | null;
  locationId?: string | null;
  createReportOpen: boolean;
  onCreateReportOpenChange: (open: boolean) => void;
  createScheduleOpen: boolean;
  onCreateScheduleOpenChange: (open: boolean) => void;
  /** The "Create report" button above the list (off where the page header already has it). */
  showCreateReport?: boolean;
  /** The "Schedule an email" button above the monthly emails (off where the page header already has it). */
  showScheduleButton?: boolean;
}) {
  const canEdit = useCanEdit();
  const block = useWriteBlock();
  return (
    <>
      <section id="reports" aria-label="PDF reports" className="scroll-mt-20">
        <StepHeading
          step={step}
          icon={FileBarChart}
          title="PDF reports"
          description="Snapshots of a location's results to view, download, share or email. Newest first."
        />
        <ReportsList
          // A new page filter starts the list's own filters afresh.
          key={`${clientId ?? "all"}|${locationId ?? "all"}`}
          clientId={clientId}
          // Narrowed to one location by the page (its chip clears it), the list stays on that location.
          {...(locationId ? { locationId } : {})}
          reportPath={(reportId) => `/reports/${encodeURIComponent(reportId)}`}
          createOpen={createReportOpen}
          onCreateOpenChange={onCreateReportOpenChange}
          showCreateButton={showCreateReport}
        />
      </section>

      <section id="schedules" aria-label="Monthly emails" className="scroll-mt-20">
        <StepHeading
          icon={CalendarClock}
          title="Monthly emails"
          description="A fresh PDF emailed right after each location's automatic monthly refresh."
          actions={
            canEdit && showScheduleButton ? (
              <span title={block.reason ?? undefined}>
                <Button size="sm" variant="outline" disabled={block.blocked} onClick={() => onCreateScheduleOpenChange(true)}>
                  <Plus aria-hidden /> Schedule an email
                </Button>
              </span>
            ) : undefined
          }
        />
        <ReportSchedulesContent clientId={clientId} locationId={locationId} onCreate={() => onCreateScheduleOpenChange(true)} />
      </section>
      {createScheduleOpen ? (
        <ScheduleReportDialog onClose={() => onCreateScheduleOpenChange(false)} defaultClientId={clientId} defaultLocationId={locationId} />
      ) : null}
    </>
  );
}
