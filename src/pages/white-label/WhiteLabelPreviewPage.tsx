import { Navigate } from "react-router-dom";

/** The branding preview is on the White-label page itself. */
function WhiteLabelPreviewPage() {
  return <Navigate to="/settings/white-label" replace />;
}

export default WhiteLabelPreviewPage;
