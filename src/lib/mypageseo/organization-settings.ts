/**
 * Organization-level (General) settings.
 *
 * Only fields the product genuinely works with today are exposed:
 * organization identity (name, country, timezone) and two defaults that are
 * applied when creating new records (new location country, new report
 * comparison period). Deleting or deactivating an organization is not a
 * supported operation anywhere in the product, so it is not surfaced.
 *
 * Real payloads always win; the demo configuration is used only while the
 * settings backend is unavailable. Remove the demo fallback below once the
 * real settings API is connected.
 */

import { withDemoFallback } from "./demo/demo-mode";
import { DEMO_ORGANIZATION_SETTINGS } from "./demo/organization-settings";

export type OrganizationSettings = {
  /** Organization / business name shown across the workspace. */
  organizationName: string;
  /** ISO country code of the organization. */
  country: string;
  /** IANA timezone used to present dates and schedule recurring work. */
  timezone: string;
  /** Country pre-selected when a new location is added. Existing locations are unchanged. */
  defaultLocationCountry: string;
  /** Comparison period pre-selected on new reports. Existing reports are unchanged. */
  defaultReportComparisonPeriod: string;
};

export type OrganizationSettingsCapabilities = {
  /** The current user may edit organization-level settings. */
  canEdit: boolean;
  /** The settings backend can persist changes. */
  canSave: boolean;
  /** The backend supports deleting or deactivating the organization. */
  canDeleteOrganization: boolean;
};

export type OrganizationSettingsResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unavailable"; reason: string }
  | {
      status: "ready";
      settings: OrganizationSettings;
      capabilities: OrganizationSettingsCapabilities;
    };

export const ORGANIZATION_NAME_MAX_LENGTH = 80;

/** IANA timezones supported by the scheduling and reporting layers. */
export const SUPPORTED_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export const REPORT_COMPARISON_PERIODS = [
  { value: "previous_period", label: "Previous period" },
  { value: "same_period_last_year", label: "Same period last year" },
] as const;

export function getOrganizationSettings(
  accountType: "business" | "agency",
  real?: OrganizationSettingsResult | null,
): OrganizationSettingsResult {
  return withDemoFallback(real, () => DEMO_ORGANIZATION_SETTINGS(accountType));
}

export type OrganizationSettingsErrors = Partial<Record<keyof OrganizationSettings, string>>;

export function validateOrganizationSettings(values: OrganizationSettings): OrganizationSettingsErrors {
  const errors: OrganizationSettingsErrors = {};
  const name = values.organizationName.trim();
  if (name.length === 0) errors.organizationName = "Enter an organization name.";
  else if (name.length > ORGANIZATION_NAME_MAX_LENGTH)
    errors.organizationName = `Use ${ORGANIZATION_NAME_MAX_LENGTH} characters or fewer.`;
  if (!values.country) errors.country = "Select a country.";
  if (!values.timezone) errors.timezone = "Select a timezone.";
  if (!values.defaultLocationCountry) errors.defaultLocationCountry = "Select a default country.";
  if (!values.defaultReportComparisonPeriod)
    errors.defaultReportComparisonPeriod = "Select a default comparison period.";
  return errors;
}

export function settingsAreEqual(a: OrganizationSettings, b: OrganizationSettings): boolean {
  return (
    a.organizationName.trim() === b.organizationName.trim() &&
    a.country === b.country &&
    a.timezone === b.timezone &&
    a.defaultLocationCountry === b.defaultLocationCountry &&
    a.defaultReportComparisonPeriod === b.defaultReportComparisonPeriod
  );
}
