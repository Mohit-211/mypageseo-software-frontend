import { Link } from "react-router-dom";
import { ArrowRight, Link2, Rocket } from "lucide-react";
import type { OnboardingStateResponse } from "@/api";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { BRAND_SETUP_PATH, gettingStartedStep, onboardingProgress, stepCopy, type OnboardingStep } from "@/lib/locations/onboarding-state";

function NextStepAction({ step, state }: { step: OnboardingStep; state: OnboardingStateResponse }) {
  const { connect } = useGbpConnect();
  const canManageSettings = useAccess().can("settings.manage");
  const unfinished = state.locations.find((location) => location.onboarding.step !== "completed");
  switch (step.id) {
    case "google":
      return (
        <Button size="sm" onClick={() => connect()}>
          <Link2 aria-hidden /> Connect Google
        </Button>
      );
    case "first_location":
      return (
        <Button asChild size="sm">
          <Link to="/locations/add">Add a location</Link>
        </Button>
      );
    case "location_setup":
      return unfinished ? (
        <Button asChild size="sm">
          <Link to={locationSetupPath(unfinished.location_id)}>Continue setup</Link>
        </Button>
      ) : null;
    case "reporting_brand":
      // Only owners reach this (`gettingStartedStep` hides the card for members): open the editor.
      return (
        <Button asChild size="sm">
          <Link to={BRAND_SETUP_PATH}>Add your brand</Link>
        </Button>
      );
    default:
      return canManageSettings ? (
        <Button asChild size="sm">
          <Link to="/settings">Open settings</Link>
        </Button>
      ) : null;
  }
}

/**
 * "Finish setting up": shown on the dashboard while the organization's setup checklist is open, so
 * choosing "Finish later" on /onboarding never loses the way back. Hidden once setup is complete,
 * for read-only users, and for members when only the owner's optional brand step is left.
 */
export function GettingStartedCard({ state }: { state: OnboardingStateResponse }) {
  const access = useAccess();
  const canEdit = useCanEdit();
  const progress = onboardingProgress(state);
  const next = gettingStartedStep(state, { canEditBrand: access.can("white_label.manage") });
  if (!next || !canEdit) return null;
  const copy = stepCopy(next.id);

  return (
    <section
      aria-labelledby="getting-started-title"
      className="rounded-xl border border-primary/25 bg-linear-to-r from-brand-tint via-card to-card p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <IconChip icon={Rocket} tone="dashboard" size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Finish setting up · {progress.done} of {progress.total} done
            </p>
            <h2 id="getting-started-title" className="mt-0.5 text-base font-semibold text-foreground">
              Next: {copy.title}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{copy.description}</p>
            <Progress value={progress.percent} aria-label={`Setup ${progress.percent}% done`} className="mt-3 h-1.5 max-w-md" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-[3.375rem] md:pl-0">
          <NextStepAction step={next} state={state} />
          <Button asChild variant="ghost" size="sm">
            <Link to="/onboarding">
              All steps <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
