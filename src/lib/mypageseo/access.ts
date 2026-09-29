/**
 * Frontend access control.
 *
 * This mirrors the access model the product already assumes — an account type
 * (business or agency) plus an administrative role on the organization. It does
 * not create new permissions and it is not a security boundary: the backend
 * remains authoritative. Its job is to keep the UI honest, so people never see
 * a control or a page they would be refused.
 *
 * When the account backend supplies real permissions, replace
 * `resolveAccessProfile` with that read; the permission ids and the components
 * that consume them stay the same.
 */

import type { AccountType } from "./navigation";

export type Permission =
  /** Agency-only surfaces: clients, client locations, client users. */
  | "clients.view"
  | "clients.manage"
  /** Agency-only branding on client-facing reports. */
  | "white_label.manage"
  /** Organization administration. */
  | "settings.manage"
  | "team.view"
  | "team.manage"
  | "billing.view"
  | "billing.manage"
  | "integrations.manage";

export type AccessProfile = {
  accountType: AccountType;
  permissions: Permission[];
};

const BUSINESS_ADMIN: Permission[] = [
  "settings.manage",
  "team.view",
  "team.manage",
  "billing.view",
  "billing.manage",
  "integrations.manage",
];

const AGENCY_ADMIN: Permission[] = [
  ...BUSINESS_ADMIN,
  "clients.view",
  "clients.manage",
  "white_label.manage",
];

/**
 * Access for the signed-in user. The account backend is not connected, so the
 * current user is treated as an administrator of their own organization —
 * agency-only permissions still exist only on agency accounts.
 */
export function resolveAccessProfile(accountType: AccountType): AccessProfile {
  console.log(accountType, "accountType")

  return {
    accountType,
    permissions: accountType === "agency" ? AGENCY_ADMIN : BUSINESS_ADMIN,
  };
}

export function hasPermission(profile: AccessProfile, permission: Permission): boolean {
  console.log(profile, "profile")
  console.log(permission, "permission")

  return profile.permissions.includes(permission);
}

/**
 * User-facing explanation for a denied permission. Deliberately free of
 * permission ids, role names and backend detail.
 */
export function accessDeniedReason(permission: Permission, accountType: AccountType): string {
  const agencyOnly =
    permission === "clients.view" ||
    permission === "clients.manage" ||
    permission === "white_label.manage";

  if (agencyOnly && accountType === "business") {
    return "This area is part of agency accounts, which manage local SEO for multiple client businesses. Your workspace manages its own locations instead.";
  }
  switch (permission) {
    case "billing.view":
    case "billing.manage":
      return "Billing is managed by the people who administer this organization. Ask one of them to make the change, or to give you access.";
    case "team.view":
    case "team.manage":
      return "Team management is limited to the people who administer this organization.";
    case "integrations.manage":
      return "Connecting and disconnecting accounts is limited to the people who administer this organization.";
    case "settings.manage":
      return "Organization settings are limited to the people who administer this organization.";
    default:
      return "Your account does not have access to this area. Someone who administers this organization can grant it.";
  }
}

/**
 * Recognises an authorization refusal coming back from the backend so it can be
 * shown as the same access state rather than a generic failure.
 */
export function isAuthorizationError(error: unknown): boolean {
  if (!error) return false;
  const status = (error as { status?: number; statusCode?: number }).status ??
    (error as { statusCode?: number }).statusCode;
  if (status === 401 || status === 403) return true;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /\b(403|401|forbidden|unauthorized|not authori[sz]ed|permission denied)\b/i.test(message);
}
