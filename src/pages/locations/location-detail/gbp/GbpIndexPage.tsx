import { Link } from "react-router-dom";
import { ArrowRight, Building2, Gauge, LoaderCircle } from "lucide-react";
import type { GbpRange, GbpReport, GbpScore, PerformanceSection } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { ChartSkeleton, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { ScoreRing } from "@/components/layout/shared/score-ring";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { GbpNotConnected, GbpPageHeader, GbpReportError, SectionUnavailable } from "@/components/gbp/gbp-ui";
import { ExtraActions, PerformanceCharts, PerformanceKpis, WhereFound } from "@/components/gbp/gbp-performance";
import { ProfileDetails, ProfileStatus } from "@/components/gbp/gbp-profile";
import { ProfileSearchTerms } from "@/components/keywords/search-terms-section";
import { ReportButton } from "@/components/report/rank-report-button";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatDate } from "@/lib/datetime";
import { RANGE_OPTIONS } from "@/lib/gbp/gbp-labels";
import { useGbpContext, useRangeParam } from "@/lib/gbp/gbp-context";
import { useGbpReport } from "@/lib/gbp/use-gbp-report";
import { locationPath } from "@/lib/mypageseo/section-links";
import { reportRangeLabel } from "@/lib/reports/report-meta";

/** GBP Overview: how the profile performs on Google, what people search, and what the profile says. */
function LocationGbpOverviewPage() {
  const { location } = useGbpContext();
  const [range, setRange] = useRangeParam();
  const report = useGbpReport(location.location_id, range);
  const connected = location.gbp_connected && report.data?.gbp_connected !== false;
  const performance = report.data?.performance.available ? report.data.performance : null;
  // Switching the period keeps the last numbers on screen until the new ones arrive.
  const updating = report.isFetching && report.isPlaceholderData;

  return (
    <>
      <GbpPageHeader
        locationId={location.location_id}
        icon={Building2}
        title="GBP Overview"
        description="How your Google Business Profile performs, what people search to find you, and what your profile shows."
        generatedAt={report.data?.generated_at}
        pending={report.data?.generation?.pending}
        gbpConnected={location.gbp_connected}
        // The GBP Audit PDF covers this page (performance for the period shown, search terms, score
        // and checks). Only with Google connected: the backend refuses it otherwise.
        actions={
          connected ? (
            <ReportButton
              locationId={location.location_id}
              type="gbp_audit"
              range={range}
              subtitle={`Performance for the ${reportRangeLabel(range)?.toLowerCase() ?? "period shown"}, search terms, profile score and checks, as a PDF.`}
            />
          ) : null
        }
      >
        {connected ? <PeriodBar range={range} onChange={setRange} performance={performance} updating={updating} /> : null}
      </GbpPageHeader>

      {!connected ? (
        <GbpNotConnected locationId={location.location_id} />
      ) : report.isPending ? (
        <OverviewSkeleton />
      ) : report.isError ? (
        <GbpReportError error={report.error} onRetry={() => void report.refetch()} gbpConnected={location.gbp_connected} locationId={location.location_id} />
      ) : (
        <div aria-busy={updating || undefined}>
          <OverviewContent report={report.data} range={range} />
        </div>
      )}
    </>
  );
}

/** The period switch, the dates it covers and an "Updating…" note while new numbers load. */
function PeriodBar({
  range,
  onChange,
  performance,
  updating,
}: {
  range: GbpRange;
  onChange: (range: GbpRange) => void;
  performance: PerformanceSection | null;
  updating: boolean;
}) {
  const partial = performance && performance.coverage.days_with_data < performance.coverage.days;
  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
      <SegmentedControl aria-label="Period" value={range} onValueChange={onChange} options={RANGE_OPTIONS} />
      {performance ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatDate(performance.start)} – {formatDate(performance.end)}
          </span>
          {" · "}
          <TermWithTip term="Google's own numbers">Google reports profile performance a few days late, so the latest days fill in over time.</TermWithTip>
          {partial ? ` · data for ${performance.coverage.days_with_data} of ${performance.coverage.days} days` : ""}
        </p>
      ) : null}
      {updating ? (
        <span role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin text-primary motion-reduce:animate-none" /> Updating…
        </span>
      ) : null}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading the GBP report" className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {["Profile views", "Customer actions", "Calls", "Website clicks", "Direction requests"].map((label, index) => (
          <KpiTile key={label} label={label} value="" loading className={index === 0 ? "col-span-2 md:col-span-1" : undefined} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}

function OverviewContent({ report, range }: { report: GbpReport; range: GbpRange }) {
  const performance = report.performance;
  const score = report.gbp_score.available ? report.gbp_score : null;
  return (
    <div className="space-y-6">
      {performance.available ? (
        <>
          <PerformanceKpis data={performance} range={range} />
          <ExtraActions data={performance} />
          <PerformanceCharts data={performance} />
        </>
      ) : (
        <Panel title="Profile performance">
          <SectionUnavailable section={performance} compact />
        </Panel>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {report.keywords.available ? (
          // The Keywords page's section: tracked or not comes from the live keyword list, never from the report.
          <ProfileSearchTerms locationId={report.location_id} terms={report.keywords} />
        ) : (
          <Panel title="Google search terms">
            <SectionUnavailable section={report.keywords} compact />
          </Panel>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {score ? <ScoreCallout score={score} locationId={report.location_id} /> : null}
          {performance.available ? <WhereFound data={performance} /> : null}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {report.profile.available ? (
          <ProfileDetails profile={report.profile} />
        ) : (
          <Panel title="Profile details">
            <SectionUnavailable section={report.profile} compact />
          </Panel>
        )}
        <ProfileStatus report={report} />
      </div>
    </div>
  );
}

/** The bridge to the audit: the profile score as a ring and what the top fixes would add. */
function ScoreCallout({ score, locationId }: { score: GbpScore; locationId: string }) {
  const fixes = score.top_fixes.length;
  const points = score.top_fixes.reduce((sum, fix) => sum + Math.max(0, fix.max - fix.points), 0);
  return (
    <section aria-labelledby="gbp-score-callout" className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 id="gbp-score-callout" className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <Gauge aria-hidden className="size-4 text-chart-2" /> Profile score
        </h2>
        <TermWithTip term={<span className="sr-only">Profile score</span>}>
          0–100: how complete, active and well-reviewed your Google profile is. A 85+, B 70+, C 55+, D 40+.
        </TermWithTip>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <ScoreRing value={score.score} label="Profile score" size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Grade {score.grade}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {fixes === 0 ? "Every check earns full points. Nice work." : `${fixes} fix${fixes === 1 ? "" : "es"} could add ${points} point${points === 1 ? "" : "s"}.`}
          </p>
        </div>
      </div>
      {/* Outline: the header's PDF report is the page's one filled action. */}
      <Button asChild variant="outline" className="mt-4 w-full">
        <Link to={locationPath(locationId, "gbp/audit")}>
          {fixes === 0 ? "Open GBP Audit" : "See what to fix"} <ArrowRight aria-hidden />
        </Link>
      </Button>
    </section>
  );
}

export default LocationGbpOverviewPage;
