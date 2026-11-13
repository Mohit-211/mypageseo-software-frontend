import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Check, Link2, Loader2, MapPinPlus, Minus, PartyPopper } from "lucide-react";
import { isApiError, setOnboardingPending, skipOnboardingStep, type OnboardingStateResponse } from "@/api";
import { OnboardingFrame } from "@/components/mypageseo/onboarding";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { locationSetupPath } from "@/lib/locations/location-actions";
import {
  BRAND_SETUP_PATH,
  ONBOARDING_QUERY_KEY,
  gettingStartedStep,
  onboardingProgress,
  onboardingStateQuery,
  stepCopy,
  type OnboardingStep,
  type OnboardingStepStatus,
} from "@/lib/locations/onboarding-state";
import { useLocationsList } from "@/lib/locations/use-locations";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";

type Location = OnboardingStateResponse["locations"][number];

/** Optional steps say so, so nobody feels blocked by them. */
const OPTIONAL = new Set(["reporting_brand"]);

/**
 * The setup checklist (`GET onboarding/state`). Steps are derived from the account's data on the
 * backend, so the page resumes wherever the user left off, and every step that opens elsewhere
 * (connect Google, add a location) updates the checklist when it finishes.
 */
function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [skipping, setSkipping] = useState<string | null>(null);
  const state = useQuery(onboardingStateQuery());
  const access = useAccess();
  // Read-only users (a client's login) can follow the checklist but not act on it. The role is
  // known once the workspace has loaded, so the buttons never flash by for them.
  const canEdit = useCanEdit();
  const workspace = useWorkspace();

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

  if (state.isPending || workspace.status === "loading") {
    return (
      <OnboardingFrame>
        <div role="status" aria-label="Loading your setup" className="space-y-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-2 w-full rounded-full" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </OnboardingFrame>
    );
  }
  if (state.isError) {
    return (
      <OnboardingFrame>
        <ErrorState compact title="Your setup couldn't be loaded" description="Check your connection and try again." onRetry={() => void state.refetch()} />
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            Go to the dashboard <ArrowRight aria-hidden />
          </Button>
        </div>
      </OnboardingFrame>
    );
  }

  const { organization, locations } = state.data;
  const progress = onboardingProgress(state.data);
  const unfinished = locations.filter((location) => location.onboarding.step !== "completed");
  const steps = organization.steps.filter((step) => step.status !== "not_available");
  // The dashboard's "Finish setting up" card shows the next step only where this person can take it.
  const onDashboardToo = canEdit && Boolean(gettingStartedStep(state.data, { canEditBrand: access.can("white_label.manage") }));

  return (
    <OnboardingFrame>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{completed ? "Setup complete" : "Getting started"}</p>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
        {completed ? (
          <>
            You're all set <PartyPopper aria-hidden className="size-6 text-primary" />
          </>
        ) : (
          "Set up MyPageSEO"
        )}
      </h1>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
        {completed
          ? "Your first ranking check starts as soon as a location's tracking is set. Your dashboard shows what to do next."
          : "A few steps and your first ranking check starts. You can leave at any time; your progress is saved."}
      </p>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            {progress.done} of {progress.total} done
          </span>
          <span className="text-muted-foreground">{progress.percent}%</span>
        </div>
        <Progress value={progress.percent} aria-label={`Setup ${progress.percent}% done`} className="h-2" />
      </div>

      <ol className="mt-6">
        {steps.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            number={index + 1}
            last={index === steps.length - 1}
            next={progress.next?.id === step.id}
            unfinished={unfinished}
            skipping={skipping}
            onSkip={(id) => void skip(id)}
          />
        ))}
      </ol>

      <div className="mt-2 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {completed ? "" : !canEdit ? "Your agency takes care of these steps." : onDashboardToo ? "You'll find the next step on your dashboard too." : ""}
        </p>
        <Button variant={completed || !canEdit ? "default" : "outline"} onClick={() => navigate("/dashboard")}>
          {completed || !canEdit ? "Go to the dashboard" : "Finish later"} <ArrowRight aria-hidden />
        </Button>
      </div>
    </OnboardingFrame>
  );
}

function StepRow({
  step,
  number,
  last,
  next,
  unfinished,
  skipping,
  onSkip,
}: {
  step: OnboardingStep;
  number: number;
  last: boolean;
  next: boolean;
  unfinished: Location[];
  skipping: string | null;
  onSkip: (id: "google" | "reporting_brand") => void;
}) {
  const copy = stepCopy(step.id);
  const done = step.status === "done";
  const skipped = step.status === "skipped";
  return (
    <li className={cn("relative pb-5 pl-12", last && "pb-3")}>
      {/* The line joining the steps; green up to the steps already done. */}
      {!last ? <span aria-hidden className={cn("absolute bottom-0 left-[15px] top-9 w-0.5 rounded-full", done ? "bg-success/50" : "bg-border")} /> : null}
      <StepMarker status={step.status} number={number} next={next} />
      <div className={cn("rounded-xl", next && "-mx-1 -mt-1 border border-primary/30 bg-brand-tint/50 p-3 shadow-xs")}>
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          {copy.title}
          {next ? (
            <StatusBadge tone="brand" size="sm">
              Next
            </StatusBadge>
          ) : null}
          {skipped ? <StatusBadge size="sm">Skipped</StatusBadge> : null}
          {OPTIONAL.has(step.id) && !done && !skipped ? <span className="text-xs font-normal text-muted-foreground">Optional</span> : null}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{copy.description}</p>
        {!done ? <StepActions step={step} next={next} unfinished={unfinished} skipping={skipping} onSkip={onSkip} /> : null}
      </div>
    </li>
  );
}

function StepMarker({ status, number, next }: { status: OnboardingStepStatus; number: number; next: boolean }) {
  const base = "absolute left-0 top-0 grid size-8 place-items-center rounded-full text-sm font-semibold";
  if (status === "done") {
    return (
      <span className={cn(base, "bg-success text-success-foreground shadow-xs")}>
        <Check aria-hidden className="size-4" strokeWidth={3} />
        <span className="sr-only">Done:</span>
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className={cn(base, "bg-muted text-muted-foreground ring-1 ring-inset ring-border-strong")}>
        <Minus aria-hidden className="size-4" />
        <span className="sr-only">Skipped:</span>
      </span>
    );
  }
  return (
    <span className={cn(base, next ? "bg-primary text-primary-foreground shadow-xs ring-4 ring-primary/15" : "bg-card text-muted-foreground ring-1 ring-inset ring-border-strong")}>
      {number}
      <span className="sr-only">{next ? "Next step:" : "To do:"}</span>
    </span>
  );
}

function StepActions({
  step,
  next,
  unfinished,
  skipping,
  onSkip,
}: {
  step: OnboardingStep;
  next: boolean;
  unfinished: Location[];
  skipping: string | null;
  onSkip: (id: "google" | "reporting_brand") => void;
}) {
  const { connect } = useGbpConnect();
  const access = useAccess();
  const canManageSettings = access.can("settings.manage");
  // Every step is a change the backend refuses for read-only users: they only follow the list.
  const canEdit = useCanEdit();
  const variant = next ? "default" : "outline";
  if (!canEdit) return null;
  const skipButton = (id: "google" | "reporting_brand") =>
    step.status === "pending" ? (
      <Button size="sm" variant="ghost" disabled={skipping !== null} onClick={() => onSkip(id)}>
        {skipping === id ? <Loader2 aria-hidden className="animate-spin" /> : null} Skip for now
      </Button>
    ) : null;

  let actions: ReactNode;
  switch (step.id) {
    case "organization_info":
    case "agency_info":
      actions = canManageSettings ? (
        <Button size="sm" variant="outline" asChild>
          <Link to="/settings">Open settings</Link>
        </Button>
      ) : null;
      break;
    case "google":
      actions = (
        <>
          <Button size="sm" variant={variant} onClick={() => connect()}>
            <Link2 aria-hidden /> Connect Google
          </Button>
          {skipButton("google")}
        </>
      );
      break;
    case "first_location":
      actions = <FirstLocationAction variant={variant} />;
      break;
    case "location_setup":
      actions =
        unfinished.length > 0 ? (
          <ul className="w-full space-y-1.5">
            {unfinished.map((location) => (
              <li key={location.location_id} className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="min-w-0 text-sm font-medium text-foreground sm:truncate">{location.name}</span>
                <Button size="sm" variant={variant} asChild>
                  <Link to={locationSetupPath(location.location_id)}>Continue setup</Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : null;
      break;
    case "reporting_brand":
      // Only the owner can save the brand; anyone who can edit may skip this optional step.
      actions = (
        <>
          {access.can("white_label.manage") ? (
            <Button size="sm" variant={variant} asChild>
              <Link to={BRAND_SETUP_PATH}>Add your brand</Link>
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">Your account owner adds the brand.</span>
          )}
          {skipButton("reporting_brand")}
        </>
      );
      break;
    default:
      actions = null;
  }
  return actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null;
}

/**
 * "Add a location", or the profiles already picked from Google when there are some: the add page
 * lists them at the top, ready to add with one click.
 */
function FirstLocationAction({ variant }: { variant: "default" | "outline" }) {
  // `pending_gbp` comes with any page of the list; one row is enough.
  const picks = useLocationsList({ page: 1, limit: 1 }).data?.pending_gbp ?? [];
  return (
    <Button size="sm" variant={variant} asChild>
      <Link to="/locations/add">
        <MapPinPlus aria-hidden /> {picks.length === 0 ? "Add a location" : picks.length === 1 ? "Add your picked profile" : `Add your ${picks.length} picked profiles`}
      </Link>
    </Button>
  );
}

export default OnboardingPage;
