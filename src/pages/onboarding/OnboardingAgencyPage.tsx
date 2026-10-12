import { Navigate } from "react-router-dom";

/** Setup is one checklist for both account types (`GET onboarding/state`). */
function OnboardingAgencyPage() {
  return <Navigate to="/onboarding" replace />;
}

export default OnboardingAgencyPage;
