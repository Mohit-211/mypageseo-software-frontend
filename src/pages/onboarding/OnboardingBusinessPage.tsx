import { Navigate } from "react-router-dom";

/** Setup is one checklist for both account types (`GET onboarding/state`). */
function OnboardingBusinessPage() {
  return <Navigate to="/onboarding" replace />;
}

export default OnboardingBusinessPage;
