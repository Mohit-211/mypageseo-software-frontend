/**
 * Demo configuration for organization-level (General) settings.
 *
 * Replace this file once the settings backend returns a real configuration.
 */
import { DEMO_ORGANIZATIONS } from "./entities";
import type { OrganizationSettingsResult } from "../organization-settings";

export function DEMO_ORGANIZATION_SETTINGS(
  accountType: "business" | "agency",
): OrganizationSettingsResult {
  const organization = accountType === "agency" ? DEMO_ORGANIZATIONS.agency : DEMO_ORGANIZATIONS.business;
  return {
    status: "ready",
    settings: {
      organizationName: organization.name,
      country: "US",
      timezone: "America/Chicago",
      defaultLocationCountry: "US",
      defaultReportComparisonPeriod: "previous_period",
    },
    capabilities: {
      canEdit: true,
      canSave: true,
      // No organization delete/deactivate operation exists in the product.
      canDeleteOrganization: false,
    },
  };
}
