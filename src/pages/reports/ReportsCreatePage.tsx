import { Navigate } from "react-router-dom";

/** Reports are created from the Reports page's "Create report" dialog. */
function ReportsCreatePage() {
  return <Navigate to="/reports" replace />;
}

export default ReportsCreatePage;
