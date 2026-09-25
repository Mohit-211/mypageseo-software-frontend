/**
 * Organization team contracts.
 *
 * Internal team members, organization roles, invitations and client scope are
 * owned by the account-management backend. That service is not wired into this
 * frontend, so this adapter falls back to a deterministic demo team for the
 * active organization until the real backend is connected.
 *
 * This is separate from `client-users.ts`: client users belong to an
 * individual agency client, while team members belong to the organization.
 */
import { withDemoFallback } from "./demo/demo-mode";
import { DEMO_TEAM_ROLES, demoTeam, demoTeamCapabilities } from "./demo/team";

export type TeamMemberStatus = "active" | "invited" | "deactivated";

export type TeamRole = {
  id: string;
  label: string;
  description: string | null;
  /** Whether this role can manage other team members. */
  canManageTeam: boolean;
};

export type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  /** Role id, matched against the roles returned with the same payload. */
  roleId: string | null;
  status: TeamMemberStatus;
  /** ISO timestamp of the last sign-in/activity, null when not tracked. */
  lastActivity: string | null;
  /** ISO timestamp an invitation was sent, only for invited members. */
  invitedAt: string | null;
  /**
   * Client ids this member is scoped to. `null` means organization-wide
   * access; an empty array means no client has been assigned yet.
   */
  clientIds: string[] | null;
  /** True for the signed-in administrator viewing this screen. */
  isCurrentUser: boolean;
};

export type TeamCapabilities = {
  canInvite: boolean;
  canResendInvite: boolean;
  canRevokeInvite: boolean;
  canEditAccess: boolean;
  canAssignClients: boolean;
  canDeactivate: boolean;
  canRemove: boolean;
};

export type TeamResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  /** No team directory is exposed for this organization. */
  | { status: "unavailable"; reason: string; capabilities: TeamCapabilities }
  | { status: "no_members"; roles: TeamRole[]; capabilities: TeamCapabilities }
  | { status: "ready"; members: TeamMember[]; roles: TeamRole[]; capabilities: TeamCapabilities };

/**
 * Team directory for an organization. Falls back to demo data while the
 * account-management backend is not connected.
 */
export function getTeam(
  organizationId: string,
  accountType: "business" | "agency",
  real?: TeamResult | null,
): TeamResult {
  return withDemoFallback(real, () => {
    const capabilities = demoTeamCapabilities(accountType);
    const roles = DEMO_TEAM_ROLES.filter((role) => (accountType === "agency" ? true : role.id !== "client_manager"));
    const members = demoTeam(organizationId, accountType);
    if (members.length === 0) {
      return { status: "no_members", roles, capabilities };
    }
    return { status: "ready", members, roles, capabilities };
  });
}

export const TEAM_STATUS_LABEL: Record<TeamMemberStatus, string> = {
  active: "Active",
  invited: "Invitation pending",
  deactivated: "Deactivated",
};

export const TEAM_STATUS_TONE: Record<TeamMemberStatus, "success" | "info" | "neutral"> = {
  active: "success",
  invited: "info",
  deactivated: "neutral",
};

export const TEAM_PAGE_SIZE = 10;

export type TeamInviteDraft = {
  name: string;
  email: string;
  roleId: string;
  clientIds: string[];
};

export type TeamInviteErrors = Partial<Record<"name" | "email" | "roleId" | "clientIds", string>>;

/** Validation for the supported invitation fields only. */
export function validateTeamInvite(
  draft: TeamInviteDraft,
  roles: TeamRole[],
  requireClientScope: boolean,
): TeamInviteErrors {
  const errors: TeamInviteErrors = {};
  if (!draft.name.trim()) errors.name = "Enter the team member's name.";
  const email = draft.email.trim();
  if (!email) errors.email = "Enter an email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Enter a valid email address.";
  if (!draft.roleId || !roles.some((role) => role.id === draft.roleId)) errors.roleId = "Select a role.";
  if (requireClientScope && draft.clientIds.length === 0) {
    errors.clientIds = "Select at least one client for this role.";
  }
  return errors;
}
