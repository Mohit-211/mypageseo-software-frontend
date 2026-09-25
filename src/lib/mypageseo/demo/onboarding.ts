/**
 * Deterministic demo onboarding state, used only while the onboarding backend
 * is unavailable. A fresh account starts at step one with nothing connected.
 *
 * Profiles and clients are derived from the canonical demo entities so that a
 * location selected during setup is the same location the rest of the product
 * shows afterwards.
 */

import { DEMO_CLIENTS, DEMO_LOCATIONS, demoLocationsForClient } from "./entities";
import type { OnboardingClientOption, OnboardingResult } from "../onboarding";
import type { GoogleBusinessProfile } from "@/components/location_component/location-setup";

function profilesFor(accountType: "business" | "agency"): GoogleBusinessProfile[] {
  const source = accountType === "business" ? demoLocationsForClient("cl_riverside") : DEMO_LOCATIONS;
  return source.map((location) => ({
    id: location.id,
    businessName: location.businessName,
    address: location.street,
    area: location.area,
    category: location.primaryCategory,
    alreadyConnected: false,
  }));
}

const CLIENT_OPTIONS: OnboardingClientOption[] = DEMO_CLIENTS.map((client) => ({
  id: client.id,
  name: client.name,
  locationCount: demoLocationsForClient(client.id).length,
}));

export function DEMO_ONBOARDING(accountType: "business" | "agency"): OnboardingResult {
  return {
    status: "ready",
    accountType,
    progress: {
      currentStep: "organization",
      completedSteps: [],
      organization: {
        organizationName: "",
        country: "US",
        timezone: "America/Chicago",
      },
      googleAccountEmail: null,
      selectedProfileId: null,
      keywords: [],
      competitors: [],
      clientId: null,
      clientName: "",
      branding: { companyName: "", logoUrl: "" },
    },
    profiles: profilesFor(accountType),
    // Existing clients an agency can assign the first location to. A brand new
    // agency can also create one by name.
    clients: accountType === "agency" ? CLIENT_OPTIONS : [],
    capabilities: {
      canAddKeywords: true,
      canAddCompetitors: true,
      googleConnectionAvailable: true,
      canComplete: true,
      canCreateClients: accountType === "agency",
      canConfigureBranding: accountType === "agency",
    },
  };
}

/** Demo Google account used when the connection step completes in demo mode. */
export const DEMO_GOOGLE_ACCOUNT_EMAIL = "operations@riversidedental.com";
export const DEMO_AGENCY_GOOGLE_ACCOUNT_EMAIL = "integrations@northbounddigital.com";

/** Demo profiles for an account type, used by the location step. */
export function demoOnboardingProfiles(
  accountType: "business" | "agency",
  clientId?: string | null,
): GoogleBusinessProfile[] {
  const profiles = profilesFor(accountType);
  if (accountType === "agency" && clientId) {
    const ids = new Set(demoLocationsForClient(clientId).map((location) => location.id));
    const scoped = profiles.filter((profile) => ids.has(profile.id));
    if (scoped.length > 0) return scoped;
  }
  return profiles;
}
