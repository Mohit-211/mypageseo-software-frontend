import { ReportDetailView } from "@/components/report/report-detail-view";
import { useRequiredParams } from "@/hooks/use-required-params";
import { useWhiteLabelAccess } from "@/lib/white-label/access";

function ReportDetailPage() {
  const { reportId } = useRequiredParams("reportId");
  // Back to where the report list lives for this user (White Label for agency staff).
  const { reportsPath, homeLabel } = useWhiteLabelAccess();
  return <ReportDetailView reportId={reportId} backTo={reportsPath} backLabel={homeLabel} />;
}

export default ReportDetailPage;
