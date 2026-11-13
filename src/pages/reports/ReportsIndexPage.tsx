import { Navigate, useLocation } from "react-router-dom";
import { CalendarClock, FileBarChart, FileCheck2, FilePlus2, Mail, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { LocationFilterChip } from "@/components/report/location-filter-chip";
import { ReportsSection } from "@/components/report/reports-section";
import { WriteBlockNote } from "@/components/report/write-block-note";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/datetime";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { usePageParams } from "@/lib/reports/page-params";
import { useReadyReportCount } from "@/lib/reports/use-report-counts";
import { useReportSchedules } from "@/lib/reports/use-report-schedules";
import { scrollToSection } from "@/lib/reports/scroll";
import { useWhiteLabelAccess } from "@/lib/white-label/access";
import { useWriteBlock } from "@/lib/white-label/write-block";

/**
 * Reports for business accounts and agency client users: PDF reports and monthly emails.
 * Agency owners and members keep theirs in White Label, so they are sent there.
 */
function ReportsPage() {
  const access = useWhiteLabelAccess();
  const { search, hash } = useLocation();

  if (!access.ready) return <PageSkeleton />;
  if (access.canWhiteLabel) {
    return (
      <>
        <Navigate to={{ pathname: "/white-label", search, hash: hash || "#reports" }} replace />
        <PageSkeleton />
      </>
    );
  }
  return <ReportsHome />;
}

function ReportsHome() {
  const access = useWhiteLabelAccess();
  const workspace = useWorkspace();
  const block = useWriteBlock();
  const [params, setParams] = usePageParams();
  const location = params.location ? (workspace.locations.find((entry) => entry.id === params.location) ?? null) : null;
  const locationId = location?.id ?? null;
  const ready = useReadyReportCount({ locationId });
  const schedules = useReportSchedules(locationId ? { location_id: locationId } : {});
  const active = schedules.data?.filter((schedule) => schedule.status === "active") ?? [];
  // The tile counts every monthly email, as the list below shows them: paused ones included.
  const totalEmails = schedules.data?.length ?? 0;
  const paused = totalEmails - active.length;
  // Sorted by the next email, so the first active one is the soonest.
  const nextEmail = active.find((schedule) => schedule.next_expected)?.next_expected ?? null;
  const business = workspace.organization?.accountType !== "agency";
  const noLocations = workspace.locations.length === 0;

  return (
    <>
      <PageHeader
        icon={FileBarChart}
        tone="reports"
        title="Reports"
        description={
          access.canEdit
            ? "PDF snapshots of your locations' results. View, download, share or email them, once or every month."
            : "PDF snapshots of your locations' results, to view and download."
        }
        meta={access.canEdit && block.blocked ? <WriteBlockNote block={block} what="New reports and emails" /> : undefined}
        actions={
          access.canEdit ? (
            <>
              <span title={block.reason ?? undefined}>
                <Button variant="outline" disabled={block.blocked || noLocations} onClick={() => setParams({ create: "schedule" })}>
                  <Plus aria-hidden /> Schedule an email
                </Button>
              </span>
              <span title={noLocations ? "Add a location first." : (block.reason ?? undefined)}>
                <Button disabled={block.blocked || noLocations} onClick={() => setParams({ create: "report" })}>
                  <FilePlus2 aria-hidden /> Create report
                </Button>
              </span>
            </>
          ) : null
        }
      >
        {location ? (
          <LocationFilterChip name={location.businessName} onClear={() => setParams({ location: null })} />
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile
          label="Ready to download"
          icon={FileCheck2}
          tone="reports"
          loading={ready.isPending}
          value={(ready.data ?? 0).toLocaleString()}
          hint={ready.data ? "PDF reports, newest first below" : "Create one in about a minute"}
          onClick={() => scrollToSection("reports")}
        />
        <KpiTile
          label="Monthly emails"
          icon={Mail}
          tone="reports"
          loading={schedules.isPending}
          value={totalEmails.toLocaleString()}
          hint={
            totalEmails === 0
              ? "None set up yet"
              : paused === 0
                ? totalEmails === 1
                  ? "Active"
                  : "All active"
                : `${active.length.toLocaleString()} active · ${paused.toLocaleString()} paused`
          }
          onClick={() => scrollToSection("schedules")}
        />
        <KpiTile
          label="Next email"
          icon={CalendarClock}
          tone="reports"
          loading={schedules.isPending}
          value={nextEmail ? formatDate(nextEmail) : "—"}
          hint={nextEmail ? "Around then, after the monthly refresh" : "Schedule one to keep people posted"}
          onClick={() => scrollToSection("schedules")}
        />
      </div>

      <ReportsSection
        locationId={locationId}
        showCreateReport={false}
        showScheduleButton={false}
        // `?create=` (e.g. the old /reports/create) opens a form only for people who can use it: a
        // read-only client user would only be refused.
        createReportOpen={access.canEdit && params.create === "report"}
        onCreateReportOpenChange={(open) => setParams({ create: open ? "report" : null })}
        createScheduleOpen={access.canEdit && params.create === "schedule"}
        onCreateScheduleOpenChange={(open) => setParams({ create: open ? "schedule" : null })}
      />
      {business ? <p className="text-xs text-muted-foreground">Reports carry MyPageSEO branding.</p> : null}
    </>
  );
}

export default ReportsPage;
