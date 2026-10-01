import { ReportDetailView } from "@/components/report/report-detail-view";
import { useRequiredParams } from "@/hooks/use-required-params";

function ReportDetailPage() {
  const { reportId } = useRequiredParams("reportId");
  return <ReportDetailView reportId={reportId} backTo="/reports" backLabel="All reports" />;
}

export default ReportDetailPage;
