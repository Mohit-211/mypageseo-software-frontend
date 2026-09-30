import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { ListSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import type { WhiteLabelSnapshot, WhiteLabelSummary } from "@/lib/white-label/white-label";
import { BrandingNotConfiguredEmpty, NoClientReportsEmpty } from "../empty-states";
import { ReportStatusBadge } from "../white-label-ui";
import { BrandingPreview, BrandingPreviewSkeleton } from "./branding-preview";
import { WhiteLabelStatus, WhiteLabelStatusSkeleton } from "./white-label-status";
import { WhiteLabelSummaryCards, WhiteLabelSummaryCardsSkeleton } from "./white-label-summary-cards";

export function WhiteLabelOverview({
  snapshot,
  summary,
  onConfigureBranding,
  onCreateReport,
  onViewReports,
  onOpenPreview,
}: {
  snapshot: WhiteLabelSnapshot;
  summary: WhiteLabelSummary;
  onConfigureBranding: () => void;
  onCreateReport: () => void;
  onViewReports: () => void;
  onOpenPreview: (reportId: string | null) => void;
}) {
  const recent = [...snapshot.reports].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const clientName = (id: string) => snapshot.clients.find((c) => c.id === id)?.name ?? "Unknown client";

  return (
    <div className="space-y-6">
      <WhiteLabelSummaryCards summary={summary} brandingConfigured={Boolean(snapshot.branding)} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {snapshot.branding ? (
          <BrandingPreview snapshot={snapshot} branding={snapshot.branding} onOpenFullPreview={onOpenPreview} />
        ) : (
          <BrandingNotConfiguredEmpty onConfigure={onConfigureBranding} className="min-h-80" />
        )}

        <div className="space-y-6">
          <WhiteLabelStatus summary={summary} branding={snapshot.branding} />
          <Panel
            title="Recent Client Reports"
            actions={
              recent.length ? (
                <Button size="sm" variant="ghost" className="-mr-2" onClick={onViewReports}>
                  View all <ArrowRight aria-hidden />
                </Button>
              ) : undefined
            }
          >
            {recent.length ? (
              <ul className="-my-1 divide-y divide-border">
                {recent.map((report) => (
                  <li key={report.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{clientName(report.clientId)}</p>
                      <p className="text-xs text-muted-foreground">Updated {format(new Date(report.updatedAt), "MMM d, yyyy")}</p>
                    </div>
                    <ReportStatusBadge status={report.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <NoClientReportsEmpty onCreate={onCreateReport} className="border-0 bg-transparent px-0 py-4" />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function WhiteLabelOverviewSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading white-label overview" className="space-y-6">
      <WhiteLabelSummaryCardsSkeleton />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <BrandingPreviewSkeleton />
        <div className="space-y-6">
          <WhiteLabelStatusSkeleton />
          <ListSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
