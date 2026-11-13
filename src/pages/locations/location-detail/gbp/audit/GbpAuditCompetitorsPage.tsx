import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Scale } from "lucide-react";
import type { GbpReport } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { ListSkeleton, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { GbpPageHeader, GbpReportError, SectionUnavailable } from "@/components/gbp/gbp-ui";
import { ComparisonKpis, ComparisonTable, Insights, RecentReviews } from "@/components/gbp/gbp-comparison";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/report/rank-report-button";
import { fixContextFor } from "@/lib/gbp/gbp-labels";
import { useGbpContext } from "@/lib/gbp/gbp-context";
import { useGbpReport } from "@/lib/gbp/use-gbp-report";
import { locationPath } from "@/lib/mypageseo/section-links";

/** Profile Comparison: public Google data side by side with nearby businesses (ranks are on Competitors). */
function GbpAuditCompetitorsPage() {
  const { location } = useGbpContext();
  const report = useGbpReport(location.location_id, "28d");

  return (
    <>
      <GbpPageHeader
        locationId={location.location_id}
        icon={Scale}
        title="Profile Comparison"
        description="How your Google profile compares with nearby businesses on what anyone can see: rating, reviews, photos and details."
        generatedAt={report.data?.generated_at}
        pending={report.data?.generation?.pending}
        gbpConnected={location.gbp_connected}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={locationPath(location.location_id, "competitors")}>
                Competitor rankings <ArrowRight aria-hidden />
              </Link>
            </Button>
            {/* The page's one filled action: right-most on wide screens, first on phones. Hidden when
                empty (a read-only client user gets no PDF button), so it adds no gap. */}
            <span className="inline-flex empty:hidden max-sm:order-first">
              <ReportButton locationId={location.location_id} type="competitor_analysis" subtitle="Public scores, the comparison table, insights and reviews, as a PDF." />
            </span>
          </>
        }
      />
      {report.isPending ? (
        <ComparisonSkeleton />
      ) : report.isError ? (
        <GbpReportError error={report.error} onRetry={() => void report.refetch()} gbpConnected={location.gbp_connected} locationId={location.location_id} />
      ) : (
        <ComparisonContent report={report.data} />
      )}
    </>
  );
}

function ComparisonSkeleton() {
  return (
    <div role="status" aria-label="Loading the comparison" className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {["Your public score", "Your rating", "Your reviews", "Your photos"].map((label) => (
          <KpiTile key={label} label={label} value="" loading />
        ))}
      </div>
      <TableSkeleton rows={6} columns={7} />
      <ListSkeleton rows={3} />
    </div>
  );
}

function ComparisonContent({ report }: { report: GbpReport }) {
  const section = report.competitors;
  if (!section.available) {
    return (
      <Panel title="Side by side">
        <SectionUnavailable section={section} compact />
      </Panel>
    );
  }
  const ctx = fixContextFor(report);
  // Google's credit for Places content goes next to the names, ratings and reviews it covers.
  const attribution = report.attribution?.text ?? null;
  return (
    <div className="space-y-6">
      {section.warning ? (
        <p role="status" className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-surface px-4 py-3 text-sm text-foreground">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          Business details couldn't be refreshed this time, so the last known details are shown.
        </p>
      ) : null}
      <ComparisonKpis section={section} />
      {/* What to do next comes before the detail. */}
      <Insights section={section} ctx={ctx} />
      <ComparisonTable section={section} locationId={report.location_id} attribution={attribution} />
      <RecentReviews rows={section.rows} attribution={attribution} />
    </div>
  );
}

export default GbpAuditCompetitorsPage;
