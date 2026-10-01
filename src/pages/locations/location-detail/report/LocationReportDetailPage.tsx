import { ReportDetailView } from "@/components/report/report-detail-view";
import { useRequiredParams } from "@/hooks/use-required-params";

function LocationReportDetailPage() {
  const { locationId, reportId } = useRequiredParams("locationId", "reportId");
  return <ReportDetailView reportId={reportId} backTo={`/locations/${locationId}/reports`} backLabel="Reports" />;
}

export default LocationReportDetailPage;
