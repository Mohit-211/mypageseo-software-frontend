/**
 * The organization's setup checklist (`GET onboarding/state`): read by `/onboarding` and by the
 * dashboard's "Finish setting up" card. Steps are derived from the account's data on the backend,
 * so any page that changes them (connect Google, add or set up a location, save the brand)
 * invalidates `ONBOARDING_QUERY_KEY`.
 */
import { queryOptions } from "@tanstack/react-query";
import { getOnboardingState, type OnboardingStateResponse } from "@/api";

export const ONBOARDING_QUERY_KEY = ["onboarding", "state"] as const;

export const onboardingStateQuery = () =>
  queryOptions({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: ({ signal }) => getOnboardingState(signal),
  });

export type OnboardingStep = OnboardingStateResponse["organization"]["steps"][number];
export type OnboardingStepStatus = OnboardingStep["status"];

/** What each organization step means, in plain words. */
export const ONBOARDING_STEP_COPY: Record<string, { title: string; description: string }> = {
  organization_info: { title: "Your business", description: "Your business name and country, from sign-up." },
  agency_info: { title: "Your agency", description: "Your agency's name and country, from sign-up." },
  google: {
    title: "Connect Google",
    description:
      "Connect the Google account that manages your Business Profiles. You can skip this and add locations from a Google Maps search instead.",
  },
  first_location: { title: "Add your first location", description: "Connect a Business Profile from Google, or find the business on Google Maps." },
  location_setup: { title: "Set up tracking", description: "Choose keywords and competitors so the first ranking check can start." },
  reporting_brand: { title: "Add your brand", description: "Your agency's name, colours and logo on client reports and client links." },
};

/** Where "Add your brand" goes: White Label with the brand editor open (the owner's). */
export const BRAND_SETUP_PATH = "/white-label?edit=brand#brand";

export function stepCopy(id: string): { title: string; description: string } {
  return ONBOARDING_STEP_COPY[id] ?? { title: id.replace(/_/g, " "), description: "" };
}

/**
 * The step the dashboard's "Finish setting up" card offers, or null when the card stays hidden:
 * setup is complete, or the only step left is the optional brand, which only the account owner can
 * add (members would get a button to a page that says so). The dashboard uses the same rule to know
 * whether the card holds the page's primary action.
 */
export function gettingStartedStep(state: OnboardingStateResponse | undefined, { canEditBrand }: { canEditBrand: boolean }): OnboardingStep | null {
  if (!state || state.organization.completed) return null;
  const next = onboardingProgress(state).next;
  if (!next) return null;
  return next.id === "reporting_brand" && !canEditBrand ? null : next;
}

/** Done and skipped steps count as handled; steps that don't apply to the account don't count. */
export function onboardingProgress(state: OnboardingStateResponse | undefined): {
  done: number;
  total: number;
  percent: number;
  next: OnboardingStep | null;
} {
  const steps = (state?.organization.steps ?? []).filter((step) => step.status !== "not_available");
  const done = steps.filter((step) => step.status === "done" || step.status === "skipped").length;
  const nextId = state?.organization.next_step ?? null;
  const next = steps.find((step) => step.id === nextId) ?? steps.find((step) => step.status === "pending") ?? null;
  return { done, total: steps.length, percent: steps.length ? Math.round((done / steps.length) * 100) : 100, next };
}
