/**
 * Business onboarding contract.
 *
 * Steps mirror the setup the product actually needs before a Business
 * workspace is usable: organization details, the Google Business Profile
 * connection, location selection, initial keywords, initial competitors and a
 * confirmation. Fields reuse the existing organization-settings and location
 * contracts; no new data model is introduced.
 *
 * Onboarding state comes from the backend so an interrupted session resumes at
 * the right step. Real payloads are authoritative; the demo snapshot is used
 * only while the onboarding backend is unavailable.
 */

import { withDemoFallback } from "./demo/demo-mode";
import {
  DEMO_AGENCY_GOOGLE_ACCOUNT_EMAIL,
  DEMO_GOOGLE_ACCOUNT_EMAIL,
  DEMO_ONBOARDING,
  demoOnboardingProfiles,
} from "./demo/onboarding";
import { demoCompetitors, demoKeywords } from "./demo/entities";
import type { GoogleBusinessProfile } from "@/components/mypageseo/location-setup";

export type OnboardingStepId =
  | "organization"
  | "google"
  | "client"
  | "location"
  | "keywords"
  | "competitors"
  | "branding"
  | "confirm";

export type OnboardingStep = { id: OnboardingStepId; label: string; optional: boolean };

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: "organization", label: "Business details", optional: false },
  { id: "google", label: "Connect Google", optional: false },
  { id: "location", label: "Select profile", optional: false },
  { id: "keywords", label: "Keywords", optional: true },
  { id: "competitors", label: "Competitors", optional: true },
  { id: "confirm", label: "Confirm", optional: false },
];

/** Agency setup adds the first client and optional report branding. */
export const AGENCY_ONBOARDING_STEPS: OnboardingStep[] = [
  { id: "organization", label: "Agency details", optional: false },
  { id: "google", label: "Connect Google", optional: false },
  { id: "client", label: "First client", optional: false },
  { id: "location", label: "Assign location", optional: false },
  { id: "keywords", label: "Keywords", optional: true },
  { id: "competitors", label: "Competitors", optional: true },
  { id: "branding", label: "Report branding", optional: true },
  { id: "confirm", label: "Confirm", optional: false },
];

export type OnboardingOrganization = {
  organizationName: string;
  country: string;
  timezone: string;
};

/** Only the white-label fields the reporting backend actually stores. */
export type OnboardingBranding = {
  companyName: string;
  logoUrl: string;
};

export type OnboardingProgress = {
  /** Step to resume at, from the backend's saved onboarding state. */
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  organization: OnboardingOrganization;
  googleAccountEmail: string | null;
  selectedProfileId: string | null;
  keywords: string[];
  competitors: string[];
  /** Agency only: existing client selected, or a new client name to create. */
  clientId: string | null;
  clientName: string;
  branding: OnboardingBranding;
};

export type OnboardingCapabilities = {
  /** The backend accepts keyword creation during onboarding. */
  canAddKeywords: boolean;
  canAddCompetitors: boolean;
  /** Google OAuth is reachable for this workspace. */
  googleConnectionAvailable: boolean;
  /** Onboarding completion can be persisted. */
  canComplete: boolean;
  /** Agency only: client creation and white-label branding during setup. */
  canCreateClients: boolean;
  canConfigureBranding: boolean;
};

export type OnboardingClientOption = { id: string; name: string; locationCount: number };

export type OnboardingResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "complete" }
  | {
      status: "ready";
      accountType: "business" | "agency";
      progress: OnboardingProgress;
      profiles: GoogleBusinessProfile[];
      clients: OnboardingClientOption[];
      capabilities: OnboardingCapabilities;
    };


export const MAX_ONBOARDING_KEYWORDS = 20;
export const MAX_ONBOARDING_COMPETITORS = 10;

export function getOnboarding(
  accountType: "business" | "agency",
  real?: OnboardingResult | null,
): OnboardingResult {
  return withDemoFallback(real, () => DEMO_ONBOARDING(accountType));
}

/**
 * Google Business Profiles the connected account can claim during onboarding.
 * `real` is the seam for the Google integration response.
 */
export function getOnboardingProfiles(
  accountType: "business" | "agency",
  clientId?: string | null,
  real?: GoogleBusinessProfile[] | null,
): GoogleBusinessProfile[] {
  return withDemoFallback(real, () => demoOnboardingProfiles(accountType, clientId));
}

/** Email of the account returned once the Google connection completes. */
export function getConnectedGoogleAccountEmail(
  accountType: "business" | "agency",
  real?: string | null,
): string {
  return withDemoFallback(real, () =>
    accountType === "agency" ? DEMO_AGENCY_GOOGLE_ACCOUNT_EMAIL : DEMO_GOOGLE_ACCOUNT_EMAIL,
  );
}

/** Keywords suggested for a location when it is selected during onboarding. */
export function getSuggestedKeywords(locationId: string, real?: string[] | null): string[] {
  return withDemoFallback(real, () =>
    demoKeywords(locationId).slice(0, 6).map((entry) => entry.keyword),
  );
}

/** Competitors suggested for a location when it is selected during onboarding. */
export function getSuggestedCompetitors(locationId: string, real?: string[] | null): string[] {
  return withDemoFallback(real, () =>
    demoCompetitors(locationId).slice(0, 3).map((entry) => entry.name),
  );
}

export function stepsFor(accountType: "business" | "agency"): OnboardingStep[] {
  return accountType === "agency" ? AGENCY_ONBOARDING_STEPS : ONBOARDING_STEPS;
}

export function stepIndex(step: OnboardingStepId, steps: OnboardingStep[] = ONBOARDING_STEPS): number {
  return steps.findIndex((entry) => entry.id === step);
}

export type ClientErrors = { clientName?: string };

/** The first client needs the name the client-management backend requires. */
export function validateClient(progress: OnboardingProgress): ClientErrors {
  if (progress.clientId) return {};
  const name = progress.clientName.trim();
  if (name.length < 2) return { clientName: "Enter the client name, or select an existing client." };
  if (name.length > 120) return { clientName: "Use fewer than 120 characters." };
  return {};
}

/** Branding is optional; a logo URL must still be a valid absolute URL. */
export function validateBranding(branding: OnboardingBranding): { logoUrl?: string } {
  const url = branding.logoUrl.trim();
  if (!url) return {};
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return { logoUrl: "Use an https logo URL." };
    return {};
  } catch {
    return { logoUrl: "Enter a valid logo URL, or leave it empty." };
  }
}


export type OrganizationErrors = Partial<Record<keyof OnboardingOrganization, string>>;

export function validateOrganization(values: OnboardingOrganization): OrganizationErrors {
  const errors: OrganizationErrors = {};
  const name = values.organizationName.trim();
  if (name.length < 2) errors.organizationName = "Enter the business name.";
  else if (name.length > 120) errors.organizationName = "Use fewer than 120 characters.";
  if (!values.country) errors.country = "Select a country.";
  if (!values.timezone) errors.timezone = "Select a timezone.";
  return errors;
}

/** Normalises a typed keyword: trimmed, collapsed whitespace, lowercase. */
export function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function canLeaveStep(
  step: OnboardingStepId,
  progress: OnboardingProgress,
  capabilities: OnboardingCapabilities,
): boolean {
  switch (step) {
    case "organization":
      return Object.keys(validateOrganization(progress.organization)).length === 0;
    case "google":
      return Boolean(progress.googleAccountEmail);
    case "location":
      return Boolean(progress.selectedProfileId);
    case "keywords":
      return capabilities.canAddKeywords ? true : true;
    case "competitors":
      return true;
    case "confirm":
      return capabilities.canComplete;
    default:
      return false;
  }
}
