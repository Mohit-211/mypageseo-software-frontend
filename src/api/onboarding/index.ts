import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { OnboardingCompleteResult, OnboardingStateResponse } from "../types/locations";

export async function getOnboardingState(signal?: AbortSignal): Promise<OnboardingStateResponse> {
  return unwrapData(await api.get(ENDPOINTS.onboarding.state, signal ? { signal } : {}));
}

/** Finishes a location's setup: queues the first rank run and sets the monthly refresh. Idempotent. */
export async function completeOnboarding(locationId: string): Promise<OnboardingCompleteResult> {
  return unwrapData(await api.post(ENDPOINTS.onboarding.complete, { location_id: locationId }));
}
