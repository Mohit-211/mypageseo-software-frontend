import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthLayout, AuthWordmark } from "@/components/auth/auth";
import {
  getOnboardingSession,
  startOnboardingSession,
} from "@/lib/auth-lib/onboarding-state";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const DESCRIPTION =
  "Finish setting up your Mypageseo workspace so local rankings, Google Business Profile data and reporting can start.";



/**
 * Entry point: resumes the saved setup session, sends completed accounts to the
 * dashboard, and routes Business and Agency accounts to their own flow.
 */
function OnboardingEntryPage() {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const session =
      getOnboardingSession() ??
      startOnboardingSession({
        accountType: workspace.organization?.accountType === "agency" ? "agency" : "business",
        ...(workspace.organization?.name ? { organizationName: workspace.organization.name } : {}),
      });

    if (session.finishedAt) {
      navigate("/dashboard", { replace: true });
      return;
    }
    navigate(session.accountType === "agency" ? "/onboarding/agency" : "/onboarding/business", { replace: true });
  }, [hydrated, navigate, workspace.organization]);

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="lg:hidden">
          <AuthWordmark className="mb-6" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading your setup…
        </div>
      </div>
    </AuthLayout>
  );
}

export default OnboardingEntryPage;
