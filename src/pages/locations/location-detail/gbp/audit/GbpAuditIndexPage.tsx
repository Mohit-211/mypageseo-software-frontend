import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import type { GbpCheck, GbpReport } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { ListSkeleton, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { GbpNotConnected, GbpPageHeader, GbpReportError, SectionUnavailable } from "@/components/gbp/gbp-ui";
import {
  CheckSheet,
  ChecksBySeverity,
  Pillars,
  PhotosSummary,
  PostsSummary,
  ReviewsSummary,
  ScoreCard,
  ScoreHistory,
  TopFixes,
} from "@/components/gbp/gbp-audit";
import { ReportButton } from "@/components/report/rank-report-button";
import { fixContextFor } from "@/lib/gbp/gbp-labels";
import { useGbpContext } from "@/lib/gbp/gbp-context";
import { useGbpReport } from "@/lib/gbp/use-gbp-report";

/** GBP Audit: the profile score, what it's made of, what to fix first, and how it changes over time. */
function LocationGbpAuditPage() {
  const { location } = useGbpContext();
  // The audit doesn't depend on the performance window; 28 days is the score's own window.
  const report = useGbpReport(location.location_id, "28d");
  const connected = location.gbp_connected && report.data?.gbp_connected !== false;

  return (
    <>
      <GbpPageHeader
        locationId={location.location_id}
        icon={ClipboardCheck}
        title="GBP Audit"
        description="Your profile score out of 100, and the fixes worth the most points."
        generatedAt={report.data?.generated_at}
        pending={report.data?.generation?.pending}
        gbpConnected={location.gbp_connected}
        actions={
          connected ? <ReportButton locationId={location.location_id} type="gbp_audit" subtitle="Profile score, checks, performance, search terms and profile details, as a PDF." /> : null
        }
      />
      {!connected ? (
        <GbpNotConnected
          locationId={location.location_id}
          title="Connect Google to audit your profile"
          description="The audit scores how complete, active and well-reviewed your Google Business Profile is, then lists the fixes worth the most points."
        />
      ) : report.isPending ? (
        <AuditSkeleton />
      ) : report.isError ? (
        <GbpReportError error={report.error} onRetry={() => void report.refetch()} gbpConnected={location.gbp_connected} locationId={location.location_id} />
      ) : (
        <AuditContent report={report.data} />
      )}
    </>
  );
}

function AuditSkeleton() {
  return (
    <div role="status" aria-label="Loading the audit" className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <SectionSkeleton lines={5} />
        <ListSkeleton rows={5} />
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}

function AuditContent({ report }: { report: GbpReport }) {
  const [selected, setSelected] = useState<GbpCheck | null>(null);
  const score = report.gbp_score;
  const ctx = fixContextFor(report);

  return (
    <div className="space-y-6">
      {score.available ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <ScoreCard score={score} history={report.score_history} v4Enabled={report.v4_enabled} />
            <TopFixes fixes={score.top_fixes} ctx={ctx} onSelect={setSelected} />
          </div>
          <Pillars score={score} />
          <ChecksBySeverity score={score} ctx={ctx} onSelect={setSelected} />
        </>
      ) : (
        <Panel title="Profile score">
          <SectionUnavailable section={score} compact />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <ReviewsSummary report={report} />
        <PhotosSummary report={report} />
        <PostsSummary report={report} />
      </div>

      <ScoreHistory history={report.score_history} />

      <CheckSheet check={selected} ctx={ctx} onClose={() => setSelected(null)} />
    </div>
  );
}

export default LocationGbpAuditPage;
