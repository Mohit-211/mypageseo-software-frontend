/**
 * Frontend access control.
 *
 * Mirrors the backend's organization roles (FRONTEND_REVIEW_CLAUDE_NOTE §0):
 * - `owner`: everything.
 * - `member`: everything except organization settings, team, billing payments
 *   and white-label branding.
 * - `client_user` (agency): read-only, limited by the backend to its clients.
 * It is not a security boundary: the backend stays authoritative. Its job is to
 * keep the UI honest, so people never see a control they would be refused.
 */

import type { AccountType } from "./navigation";

export type Permission =
  /** Agency-only surfaces: clients, client locations, client users. */
  | "clients.view"
  /** Edit a client's details (a limited member: its own clients). */
  | "clients.manage"
  /** Create / delete clients and leave a location without a client (not a limited member). */
  | "clients.admin"
  /** Agency-only branding on client-facing reports (owner). */
  | "white_label.manage"
  /** Organization administration (owner). */
  | "settings.manage"
  | "team.view"
  | "team.manage"
  | "billing.view"
  | "billing.manage"
  | "integrations.manage"
  /** Any write on locations, rankings, reviews, posts and reports (not client_user). */
  | "workspace.edit";

export type Role = "owner" | "member" | "client_user";

export type AccessProfile = {
  accountType: AccountType;
  role: Role;
  /** Phase 21: a member limited to some clients (or a client_user). Its client picker is required. */
  restricted: boolean;
  permissions: Permission[];
};

const MEMBER: Permission[] = ["billing.view", "integrations.manage", "workspace.edit"];
const OWNER: Permission[] = [...MEMBER, "settings.manage", "team.view", "team.manage", "billing.manage"];
const AGENCY_EXTRA: Record<Role, Permission[]> = {
  owner: ["clients.view", "clients.manage", "clients.admin", "white_label.manage"],
  member: ["clients.view", "clients.manage", "clients.admin"],
  client_user: [],
};

export function toRole(role: string | null | undefined): Role {
  return role === "member" || role === "client_user" ? role : "owner";
}

/**
 * Access for the signed-in user from the organization's account type, the user's role in it,
 * and whether a member is limited to some clients (Phase 21: no `clients.admin`).
 */
export function resolveAccessProfile(accountType: AccountType, role: Role = "owner", restricted = false): AccessProfile {
  const base = role === "owner" ? OWNER : role === "member" ? MEMBER : [];
  const agency = AGENCY_EXTRA[role].filter((permission) => !(restricted && role === "member" && permission === "clients.admin"));
  return {
    accountType,
    role,
    restricted: role === "client_user" || (role === "member" && restricted),
    permissions: accountType === "agency" ? [...base, ...agency] : base,
  };
}

export function hasPermission(profile: AccessProfile, permission: Permission): boolean {
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
    case "clients.admin":
      return "The account owner creates and deletes clients. You work on the clients assigned to you.";
    case "workspace.edit":
      return "Your access is read-only. Ask the agency that manages this account to make changes.";
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
