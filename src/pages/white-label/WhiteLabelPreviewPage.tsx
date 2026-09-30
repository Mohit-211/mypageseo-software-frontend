import { useParams } from "react-router-dom";
import { RequireAccess } from "@/components/mypageseo/access";
import { ReportPreviewPage } from "@/components/white-label/client-report-preview/report-preview-page";

/** Full-screen client report preview. Rendered without the app shell, like the client sees it. */
function WhiteLabelPreviewPage() {
  const { reportId } = useParams();
  return (
    <RequireAccess permission="white_label.manage">
      <ReportPreviewPage key={reportId ?? "default"} reportId={reportId ?? null} />
    </RequireAccess>
  );
}

export default WhiteLabelPreviewPage;
