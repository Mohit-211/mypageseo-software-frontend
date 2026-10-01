/**
 * Shared onboarding flow used by both Business and Agency setup.
 *
 * One step engine drives both account types; the step list (and the bodies it
 * renders) differ per account type via `stepsFor`. In-progress answers live in
 * the local onboarding session store so moving back and forth — or refreshing —
 * never loses input.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { AuthField, AuthHeading, AuthInput } from "@/components/auth/auth";
import {
  BusinessProfileSelector,
  GoogleBusinessConnection,
  LocationConfirmation,
  type GoogleConnectionState,
} from "@/components/location/location-setup";
import { ChipStep, OnboardingFrame, StepProgress, SummaryRow } from "@/components/mypageseo/onboarding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries } from "@/lib/mock-data/countries";
import { SUPPORTED_TIMEZONES } from "@/lib/mypageseo/organization-settings";
import {
  MAX_ONBOARDING_COMPETITORS,
  MAX_ONBOARDING_KEYWORDS,
  getConnectedGoogleAccountEmail,
  getOnboarding,
  getOnboardingProfiles,
  getSuggestedCompetitors,
  getSuggestedKeywords,
  normalizeKeyword,
  stepIndex,
  stepsFor,
  validateBranding,
  validateOrganization,
  type OnboardingProgress,
  type OnboardingStepId,
  type OrganizationErrors,
} from "@/lib/mypageseo/onboarding";
import {
  startOnboardingSession,
  updateOnboardingSession,
  useOnboardingSession,
} from "@/lib/auth/onboarding-state";

type AccountType = "business" | "agency";

const STEP_COPY: Record<OnboardingStepId, { title: string; description: string }> = {
  organization: {
    title: "Business details",
    description: "Tell us about the organization this workspace belongs to.",
  },
  google: {
    title: "Connect Google",
    description:
      "Mypageseo reads the Google Business Profile you choose — profile details, reviews and posts — to track local performance.",
  },
  location: {
    title: "Select location",
    description: "Choose the Google Business Profile this workspace will manage.",
  },
  keywords: {
    title: "Keywords",
    description: "Add the local searches that matter for this location.",
  },
  competitors: {
    title: "Competitors",
    description: "Add nearby businesses you want to compare against.",
  },
  branding: {
    title: "Reporting brand",
    description: "Branding applied to client-facing reports. You can change it later in settings.",
  },
  confirm: {
    title: "Review & finish",
    description: "Check the setup below before finishing.",
  },
};

export function OnboardingFlow({ accountType }: { accountType: AccountType }) {
  const session = useOnboardingSession();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // A user landing straight on the setup URL gets a fresh session.
  useEffect(() => {
    if (!hydrated) return;
    if (!session || session.accountType !== accountType) {
      startOnboardingSession({ accountType });
    }
  }, [hydrated, session, accountType]);

  const result = getOnboarding(accountType);

  if (!hydrated || !session || session.accountType !== accountType || result.status === "loading") {
    return (
      <OnboardingFrame>
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Loading your setup…
        </div>
      </OnboardingFrame>
    );
  }

  if (result.status === "error") {
    return (
      <OnboardingFrame>
        <AuthHeading title="Setup could not be loaded" description={result.message} />
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </OnboardingFrame>
    );
  }

  if (session.finishedAt || result.status === "complete") {
    return <CompletionPanel accountType={accountType} />;
  }

  return (
    <FlowBody
      accountType={accountType}
      progress={session.progress}
      step={session.step}
      completedSteps={session.completedSteps}
      clients={result.status === "ready" ? result.clients : []}
      capabilities={
        result.status === "ready"
          ? result.capabilities
          : {
              canAddKeywords: false,
              canAddCompetitors: false,
              googleConnectionAvailable: false,
              canComplete: false,
              canCreateClients: false,
              canConfigureBranding: false,
            }
      }
    />
  );
}

function CompletionPanel({ accountType }: { accountType: AccountType }) {
  return (
    <OnboardingFrame>
      <AuthHeading
        title="Setup complete"
        description={
          accountType === "agency"
            ? "Your agency workspace is ready. Your first location is now tracked."
            : "Your workspace is ready. Your location, keywords and competitors are now tracked."
        }
      />
      <Alert className="mt-6">
        <Check aria-hidden />
        <AlertTitle>Everything is set up</AlertTitle>
        <AlertDescription>
          Rankings, Google Business Profile data, citations, competitors and reports all use the
          location you selected.
        </AlertDescription>
      </Alert>
      <Button asChild className="mt-6">
        <Link to="/dashboard">Go to dashboard</Link>
      </Button>
    </OnboardingFrame>
  );
}

function FlowBody({
  accountType,
  progress,
  step,
  completedSteps,
  clients,
  capabilities,
}: {
  accountType: AccountType;
  progress: OnboardingProgress;
  step: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  clients: { id: string; name: string; locationCount: number }[];
  capabilities: {
    canAddKeywords: boolean;
    canAddCompetitors: boolean;
    googleConnectionAvailable: boolean;
    canComplete: boolean;
    canCreateClients: boolean;
    canConfigureBranding: boolean;
  };
}) {
  const navigate = useNavigate();
  const steps = stepsFor(accountType);
  const index = stepIndex(step, steps);

  const [orgErrors, setOrgErrors] = useState<OrganizationErrors>({});
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [connection, setConnection] = useState<GoogleConnectionState>(
    progress.googleAccountEmail ? "connected" : "disconnected",
  );
  const [profileQuery, setProfileQuery] = useState("");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keywordError, setKeywordError] = useState<string | null>(null);
  const [competitorDraft, setCompetitorDraft] = useState("");
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const profiles = useMemo(
    () => getOnboardingProfiles(accountType, progress.clientId),
    [accountType, progress.clientId],
  );
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === progress.selectedProfileId) ?? null,
    [profiles, progress.selectedProfileId],
  );

  const patch = (update: Partial<OnboardingProgress>) =>
    updateOnboardingSession((current) => ({
      ...current,
      progress: { ...current.progress, ...update },
    }));

  const goTo = (next: OnboardingStepId, markCurrentComplete: boolean) =>
    updateOnboardingSession((current) => ({
      ...current,
      step: next,
      completedSteps: markCurrentComplete
        ? Array.from(new Set([...current.completedSteps, current.step]))
        : current.completedSteps,
    }));

  const stepValid = (): boolean => {
    switch (step) {
      case "organization": {
        const errors = validateOrganization(progress.organization);
        setOrgErrors(errors);
        return Object.keys(errors).length === 0;
      }
      case "google": {
        if (!progress.googleAccountEmail) return false;
        return true;
      }
      case "location":
        return Boolean(progress.selectedProfileId);
      case "branding": {
        const errors = validateBranding(progress.branding);
        setBrandingError(errors.logoUrl ?? null);
        return !errors.logoUrl;
      }
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!stepValid()) return;
    const next = steps[index + 1];
    if (next) goTo(next.id, true);
  };

  const goBack = () => {
    const previous = steps[index - 1];
    if (previous) goTo(previous.id, false);
  };

  const connectGoogle = () => {
    if (!capabilities.googleConnectionAvailable) {
      setConnection("error");
      return;
    }
    setConnection("connecting");
    window.setTimeout(() => {
      setConnection("connected");
      patch({
        googleAccountEmail: getConnectedGoogleAccountEmail(accountType),
      });
    }, 700);
  };

  /** Selecting a location seeds the suggested keywords and competitors for it. */
  const selectProfile = (profileId: string) => {
    const suggestedKeywords = getSuggestedKeywords(profileId);
    const suggestedCompetitors = getSuggestedCompetitors(profileId);
    patch({
      selectedProfileId: profileId,
      keywords: progress.keywords.length > 0 ? progress.keywords : suggestedKeywords,
      competitors: progress.competitors.length > 0 ? progress.competitors : suggestedCompetitors,
    });
  };

  const addKeyword = () => {
    const value = normalizeKeyword(keywordDraft);
    if (value.length < 2) return setKeywordError("Enter a keyword with at least 2 characters.");
    if (progress.keywords.includes(value)) return setKeywordError("That keyword is already in the list.");
    if (progress.keywords.length >= MAX_ONBOARDING_KEYWORDS)
      return setKeywordError(`You can add up to ${MAX_ONBOARDING_KEYWORDS} keywords during setup.`);
    patch({ keywords: [...progress.keywords, value] });
    setKeywordDraft("");
    setKeywordError(null);
  };

  const addCompetitor = () => {
    const value = competitorDraft.trim();
    if (value.length < 2) return setCompetitorError("Enter the competitor business name or website.");
    if (progress.competitors.some((item) => item.toLowerCase() === value.toLowerCase()))
      return setCompetitorError("That competitor is already in the list.");
    if (progress.competitors.length >= MAX_ONBOARDING_COMPETITORS)
      return setCompetitorError(
        `You can add up to ${MAX_ONBOARDING_COMPETITORS} competitors during setup.`,
      );
    patch({ competitors: [...progress.competitors, value] });
    setCompetitorDraft("");
    setCompetitorError(null);
  };

  const finish = () => {
    if (!capabilities.canComplete) {
      setFinishError("Setup can't be completed yet because the account service isn't connected.");
      return;
    }
    setFinishing(true);
    setFinishError(null);
    window.setTimeout(() => {
      updateOnboardingSession((current) => ({
        ...current,
        step: "confirm",
        completedSteps: steps.map((entry) => entry.id),
        finishedAt: new Date().toISOString(),
      }));
      // The account type, clients and locations come from the organization itself (GET auth/me, GET locations).
      setFinishing(false);
      navigate("/dashboard");
    }, 700);
  };

  const requiredMissing = !progress.googleAccountEmail || !progress.selectedProfileId;
  const nextDisabled =
    finishing ||
    (step === "google" && !progress.googleAccountEmail) ||
    (step === "location" && !progress.selectedProfileId);

  const copy = STEP_COPY[step];
  const clientName = progress.clientId
    ? (clients.find((client) => client.id === progress.clientId)?.name ?? null)
    : progress.clientName.trim() || null;

  return (
    <OnboardingFrame>
      <AuthHeading
        title={accountType === "agency" ? "Set up your agency workspace" : "Set up your workspace"}
        description={
          accountType === "agency"
            ? "Connect Google and add your first location, then Mypageseo starts tracking local performance."
            : "A few short steps connect your Google Business Profile and start local ranking, review and citation tracking."
        }
      />

      <StepProgress
        current={step}
        steps={steps}
        completed={completedSteps}
        onStepSelect={(target) => goTo(target, false)}
      />

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-foreground">{copy.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <div className="mt-5 space-y-5">
        {step === "organization" ? (
          <fieldset className="space-y-4">
            <legend className="sr-only">Organization details</legend>
            <AuthField
              label={accountType === "agency" ? "Agency name" : "Business name"}
              htmlFor="org-name"
              error={orgErrors.organizationName}
            >
              <AuthInput
                id="org-name"
                value={progress.organization.organizationName}
                invalid={Boolean(orgErrors.organizationName)}
                onChange={(event) =>
                  patch({
                    organization: { ...progress.organization, organizationName: event.target.value },
                  })
                }
                placeholder={accountType === "agency" ? "Northbound Digital" : "Riverside Dental Group"}
              />
            </AuthField>

            <div>
              <Label htmlFor="org-country">Country</Label>
              <Select
                value={progress.organization.country}
                onValueChange={(value) =>
                  patch({ organization: { ...progress.organization, country: value } })
                }
              >
                <SelectTrigger id="org-country" className="mt-1.5">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {orgErrors.country ? (
                <p className="mt-1.5 text-sm text-critical">{orgErrors.country}</p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="org-timezone">Timezone</Label>
              <Select
                value={progress.organization.timezone}
                onValueChange={(value) =>
                  patch({ organization: { ...progress.organization, timezone: value } })
                }
              >
                <SelectTrigger id="org-timezone" className="mt-1.5">
                  <SelectValue placeholder="Select a timezone" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TIMEZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {orgErrors.timezone ? (
                <p className="mt-1.5 text-sm text-critical">{orgErrors.timezone}</p>
              ) : null}
              <p className="mt-1.5 text-xs text-muted-foreground">
                Used for report dates and scheduled work.
              </p>
            </div>
          </fieldset>
        ) : null}

        {step === "google" ? (
          <div className="space-y-4">
            {progress.googleAccountEmail ? (
              <Alert>
                <Check aria-hidden />
                <AlertTitle>Google account connected</AlertTitle>
                <AlertDescription>
                  <p>Connected as {progress.googleAccountEmail}.</p>
                  <p className="text-xs">
                    Preview connection: this environment isn’t linked to Google yet, so profile data
                    shown during setup is sample data.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      patch({ googleAccountEmail: null, selectedProfileId: null });
                      setConnection("disconnected");
                    }}
                  >
                    Use a different account
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <GoogleBusinessConnection
                state={connection}
                onConnect={connectGoogle}
                onRetry={connectGoogle}
              />
            )}
          </div>
        ) : null}

        {step === "location" ? (
          <div className="space-y-4">
            {accountType === "agency" && clientName ? (
              <p className="text-sm text-muted-foreground">
                Assigning to <span className="font-medium text-foreground">{clientName}</span>.
              </p>
            ) : null}
            <BusinessProfileSelector
              profiles={profiles}
              query={profileQuery}
              {...(progress.selectedProfileId ? { selectedId: progress.selectedProfileId } : {})}
              onQueryChange={setProfileQuery}
              onSelect={(profile) => selectProfile(profile.id)}
            />
            {selectedProfile ? <LocationConfirmation profile={selectedProfile} /> : null}
          </div>
        ) : null}

        {step === "keywords" ? (
          <ChipStep
            title="Keywords to track"
            description="Add the local searches that matter for this location. You can add more later."
            supported={capabilities.canAddKeywords}
            unsupportedNote="Keyword setup isn't available during onboarding for this workspace. You can add keywords from Rankings afterwards."
            placeholder="emergency dentist austin"
            draft={keywordDraft}
            onDraftChange={(value) => {
              setKeywordDraft(value);
              setKeywordError(null);
            }}
            onAdd={addKeyword}
            error={keywordError}
            items={progress.keywords}
            onRemove={(value) =>
              patch({ keywords: progress.keywords.filter((item) => item !== value) })
            }
            emptyNote="Optional — skip this step to add keywords later."
          />
        ) : null}

        {step === "competitors" ? (
          <ChipStep
            title="Competitors to watch"
            description="Add nearby businesses you want to compare against. You can change this later."
            supported={capabilities.canAddCompetitors}
            unsupportedNote="Competitor setup isn't available during onboarding for this workspace. You can add competitors from the Competitors screen afterwards."
            placeholder="Lakeline Family Dental"
            draft={competitorDraft}
            onDraftChange={(value) => {
              setCompetitorDraft(value);
              setCompetitorError(null);
            }}
            onAdd={addCompetitor}
            error={competitorError}
            items={progress.competitors}
            onRemove={(value) =>
              patch({ competitors: progress.competitors.filter((item) => item !== value) })
            }
            emptyNote="Optional — skip this step to add competitors later."
          />
        ) : null}

        {step === "branding" ? (
          capabilities.canConfigureBranding ? (
            <section className="space-y-4 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-5">
              <AuthField label="Company name on reports" htmlFor="brand-name">
                <AuthInput
                  id="brand-name"
                  value={progress.branding.companyName}
                  placeholder="Northbound Digital"
                  onChange={(event) =>
                    patch({ branding: { ...progress.branding, companyName: event.target.value } })
                  }
                />
              </AuthField>
              <AuthField
                label="Logo URL"
                htmlFor="brand-logo"
                error={brandingError ?? undefined}
                hint="Public https link to your logo image."
              >
                <AuthInput
                  id="brand-logo"
                  value={progress.branding.logoUrl}
                  invalid={Boolean(brandingError)}
                  placeholder="https://example.com/logo.png"
                  onChange={(event) => {
                    setBrandingError(null);
                    patch({ branding: { ...progress.branding, logoUrl: event.target.value } });
                  }}
                />
              </AuthField>
            </section>
          ) : (
            <Alert>
              <AlertCircle aria-hidden />
              <AlertTitle>Report branding</AlertTitle>
              <AlertDescription>
                Report branding isn’t available during setup for this workspace. You can configure it
                later under Settings → White label.
              </AlertDescription>
            </Alert>
          )
        ) : null}

        {step === "confirm" ? (
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-5">
              <h3 className="text-sm font-semibold text-foreground">Setup summary</h3>
              <dl className="mt-3 space-y-3 text-sm">
                <SummaryRow
                  label={accountType === "agency" ? "Agency" : "Business"}
                  value={progress.organization.organizationName}
                />
                <SummaryRow
                  label="Country"
                  value={
                    countries.find((country) => country.code === progress.organization.country)?.name ??
                    progress.organization.country
                  }
                />
                <SummaryRow label="Timezone" value={progress.organization.timezone} />
                <SummaryRow
                  label="Google account"
                  value={progress.googleAccountEmail}
                  missingLabel="Not connected — required"
                  required
                />
                {accountType === "agency" ? (
                  <SummaryRow
                    label="Client"
                    value={clientName}
                    missingLabel="Not set — required"
                    required
                  />
                ) : null}
                <SummaryRow
                  label="Location"
                  value={
                    selectedProfile
                      ? `${selectedProfile.businessName}${selectedProfile.area ? ` · ${selectedProfile.area}` : ""}`
                      : null
                  }
                  missingLabel="Not selected — required"
                  required
                />
                <SummaryRow
                  label={`Keywords (${progress.keywords.length})`}
                  value={progress.keywords.length > 0 ? progress.keywords.join(", ") : null}
                  missingLabel="None added — optional"
                />
                <SummaryRow
                  label={`Competitors (${progress.competitors.length})`}
                  value={progress.competitors.length > 0 ? progress.competitors.join(", ") : null}
                  missingLabel="None added — optional"
                />
                {accountType === "agency" ? (
                  <SummaryRow
                    label="Report brand"
                    value={progress.branding.companyName || null}
                    missingLabel="Not set — optional"
                  />
                ) : null}
              </dl>
            </section>

            {requiredMissing ? (
              <Alert className="border-critical/25 bg-critical-surface/40">
                <AlertCircle aria-hidden />
                <AlertTitle>Required setup is missing</AlertTitle>
                <AlertDescription>
                  Go back and complete the highlighted steps before finishing.
                </AlertDescription>
              </Alert>
            ) : null}

            {finishError ? (
              <Alert className="border-critical/25 bg-critical-surface/40">
                <AlertCircle aria-hidden />
                <AlertTitle>Setup could not be completed</AlertTitle>
                <AlertDescription>{finishError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={goBack} disabled={index === 0 || finishing}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {steps[index]?.optional ? (
            <Button variant="outline" onClick={() => goNext()} disabled={finishing}>
              Skip for now
            </Button>
          ) : null}
          {step === "confirm" ? (
            <Button onClick={finish} disabled={finishing || requiredMissing}>
              {finishing ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
              {finishing ? "Finishing setup…" : "Finish setup"}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={nextDisabled}>
              Continue <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </OnboardingFrame>
  );
}
