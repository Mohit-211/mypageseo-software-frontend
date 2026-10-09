/**
 * Organization settings (`GET/PATCH organization`). The backend stores the name and
 * the country (US or Canada); only the owner can change them.
 */

import type { OrganizationCountry } from "@/api";

export type OrganizationSettings = {
  organizationName: string;
  country: OrganizationCountry | "";
};

export const ORGANIZATION_NAME_MAX_LENGTH = 80;

export const ORGANIZATION_COUNTRIES: { value: OrganizationCountry; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
];

/** IANA timezones offered by the onboarding flow. */
export const SUPPORTED_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/St_Johns",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

export type OrganizationSettingsErrors = Partial<Record<keyof OrganizationSettings, string>>;

export function validateOrganizationSettings(values: OrganizationSettings): OrganizationSettingsErrors {
  const errors: OrganizationSettingsErrors = {};
  const name = values.organizationName.trim();
  if (!name) errors.organizationName = "Enter an organization name.";
  else if (name.length > ORGANIZATION_NAME_MAX_LENGTH)
    errors.organizationName = `Use ${ORGANIZATION_NAME_MAX_LENGTH} characters or fewer.`;
  if (!values.country) errors.country = "Select a country.";
  return errors;
}

export function settingsAreEqual(a: OrganizationSettings, b: OrganizationSettings): boolean {
  return a.organizationName.trim() === b.organizationName.trim() && a.country === b.country;
}
