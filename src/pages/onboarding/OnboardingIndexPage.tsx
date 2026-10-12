import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Check, Circle, Loader2, Minus } from "lucide-react";
import {
  getOnboardingState,
  isApiError,
  setOnboardingPending,
  skipOnboardingStep,
  type OnboardingStateResponse,
} from "@/api";
import { OnboardingFrame } from "@/components/mypageseo/onboarding";
import { ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { cn } from "@/lib/utils";

type StepStatus = OnboardingStateResponse["organization"]["steps"][number]["status"];
type Location = OnboardingStateResponse["locations"][number];

const STEP_COPY: Record<string, { title: string; description: string }> = {
  organization_info: { title: "Your business", description: "Your organization's name and country, from signup." },
  agency_info: { title: "Your agency", description: "Your agency's name and country, from signup." },
  google: {
    title: "Connect Google",
    description: "Connect the Google account that manages your Business Profiles. You can skip this and add locations from a Google Maps search instead.",
  },
  first_location: { title: "Add your first location", description: "Pick a business on Google Maps, or bind a Business Profile you connected." },
  location_setup: { title: "Set up tracking", description: "Choose keywords and competitors so the first ranking run can start." },
  reporting_brand: { title: "Reporting brand", description: "Your agency's name, colours and logo on client reports. Optional." },
};

const ONBOARDING_QUERY_KEY = ["onboarding", "state"] as const;

/**
 * Setup checklist from `GET onboarding/state`. Steps are derived from the account's
 * data on the backend, so the page resumes wherever the user left off.
 */
function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { connect } = useGbpConnect();
  const [skipping, setSkipping] = useState<string | null>(null);
  const state = useQuery({ queryKey: ONBOARDING_QUERY_KEY, queryFn: ({ signal }) => getOnboardingState(signal) });

  const completed = state.data?.organization.completed ?? false;
  useEffect(() => {
    if (state.data) setOnboardingPending(!completed);
  }, [state.data, completed]);

  const skip = async (step: "google" | "reporting_brand") => {
    setSkipping(step);
    try {
      queryClient.setQueryData(ONBOARDING_QUERY_KEY, await skipOnboardingStep(step));
    } catch (err) {
      toast.error(isApiError(err) && err.message ? err.message : "That step couldn't be skipped. Try again.");
    } finally {
      setSkipping(null);
    }
  };

  if (state.isPending) {
    return (
      <OnboardingFrame>
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Loading your setup…
        </p>
      </OnboardingFrame>
    );
  }
  if (state.isError) {
    return (
      <OnboardingFrame>
        <ErrorState description="Your setup steps couldn't be loaded." onRetry={() => void state.refetch()} />
      </OnboardingFrame>
    );
  }

  const { organization, locations } = state.data;
  const unfinished = locations.filter((location) => location.onboarding.step !== "completed");

  const actionFor = (id: string, status: StepStatus) => {
    if (status === "done" || status === "not_available") return null;
    switch (id) {
      case "organization_info":
      case "agency_info":
        return <Button size="sm" variant="outline" asChild><Link to="/settings">Open settings</Link></Button>;
      case "google":
        return (
          <>
            <Button size="sm" onClick={() => connect()}>Connect Google</Button>
            {status === "pending" ? (
              <Button size="sm" variant="ghost" disabled={skipping !== null} onClick={() => void skip("google")}>
                {skipping === "google" ? <Loader2 aria-hidden className="animate-spin" /> : null} Skip
              </Button>
            ) : null}
          </>
        );
      case "first_location":
        return <Button size="sm" asChild><Link to="/locations/add">Add a location</Link></Button>;
      case "location_setup":
        return unfinished.length > 0 ? <UnfinishedLocations locations={unfinished} /> : null;
      case "reporting_brand":
        return (
          <>
            <Button size="sm" variant="outline" asChild><Link to="/settings/white-label">Set up branding</Link></Button>
            {status === "pending" ? (
              <Button size="sm" variant="ghost" disabled={skipping !== null} onClick={() => void skip("reporting_brand")}>
                {skipping === "reporting_brand" ? <Loader2 aria-hidden className="animate-spin" /> : null} Skip
              </Button>
            ) : null}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <OnboardingFrame>
      <h1 className="text-xl font-semibold text-foreground">{completed ? "You're all set" : "Set up MyPageSEO"}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {completed
          ? "Setup is finished. Your first ranking run starts as soon as a location's tracking is set."
          : "Finish these steps to start tracking. You can leave and come back; your progress is saved."}
      </p>

      <ol className="mt-6 space-y-3">
        {organization.steps.map((step) => {
          const copy = STEP_COPY[step.id] ?? { title: step.id, description: "" };
          const next = organization.next_step === step.id;
          const action = actionFor(step.id, step.status);
          return (
            <li
              key={step.id}
              className={cn("rounded-lg border bg-surface p-4", next ? "border-primary/40 shadow-card" : "border-border")}
            >
              <div className="flex items-start gap-3">
                <StatusIcon status={step.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {copy.title}
                    {step.status === "skipped" ? <span className="ml-2 text-xs font-normal text-muted-foreground">Skipped</span> : null}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{copy.description}</p>
                  {action ? <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex justify-end">
        <Button variant={completed ? "default" : "ghost"} onClick={() => navigate("/dashboard")}>
          {completed ? "Go to dashboard" : "Finish later"} <ArrowRight aria-hidden />
        </Button>
      </div>
    </OnboardingFrame>
  );
}

function UnfinishedLocations({ locations }: { locations: Location[] }) {
  return (
    <ul className="w-full space-y-1.5">
      {locations.map((location) => (
        <li key={location.location_id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <span className="truncate text-sm text-foreground">{location.name}</span>
          <Button size="sm" variant="outline" asChild>
            <Link to={locationSetupPath(location.location_id)}>Continue setup</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
        <Check aria-label="Done" className="size-3.5" />
      </span>
    );
  }
  if (status === "skipped" || status === "not_available") {
    return (
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Minus aria-label={status === "skipped" ? "Skipped" : "Not available"} className="size-3.5" />
      </span>
    );
  }
  return <Circle aria-label="To do" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />;
}

export default OnboardingPage;
