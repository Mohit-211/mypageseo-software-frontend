import { Navigate, useLocation } from "react-router-dom";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { WhiteLabelHub } from "@/components/white-label/white-label-hub";
import { useWhiteLabelAccess } from "@/lib/white-label/access";

/**
 * White Label (agency owners and members): the brand, a client link per location and the PDF
 * reports with their monthly emails, on one page. Business accounts and client users have
 * Reports instead and are sent there (keeping `?location=` and the rest of the address).
 */
function WhiteLabelPage() {
  const access = useWhiteLabelAccess();
  const { search } = useLocation();

  // Wait for the account type and role: an agency must not be bounced to Reports on a guess.
  if (!access.ready) return <PageSkeleton />;
  if (!access.canWhiteLabel) {
    return (
      <>
        <Navigate to={{ pathname: "/reports", search }} replace />
        <PageSkeleton />
      </>
    );
  }
  return <WhiteLabelHub />;
}

export default WhiteLabelPage;
