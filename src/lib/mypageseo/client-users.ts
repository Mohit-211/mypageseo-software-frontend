/**
 * Client user access contracts.
 *
 * Client users, roles, invitations and access assignment are owned by the
 * agency account-management backend. That service is not wired into this
 * frontend, so this adapter falls back to a deterministic demo directory
 * scoped to the active client until the real backend is connected.
 */
import { withDemoFallback } from "./demo/demo-mode";
import { DEMO_CLIENT_USER_ROLES, demoClientUsers, demoClientUsersFallback } from "./demo/client-users";

export type ClientUserStatus = "active" | "invited" | "pending" | "suspended";

export type ClientUserRole = {
  id: string;
  label: string;
  description: string | null;
};

export type ClientUser = {
  id: string;
  name: string | null;
  email: string;
  /** Role id, matched against the roles returned with the same payload. */
  roleId: string | null;
  status: ClientUserStatus;
  /** ISO timestamp, null when the backend does not track activity. */
  lastActivity: string | null;
  /** Location ids this user can access, null when access is account-wide. */
  locationIds: string[] | null;
};

export type ClientUserCapabilities = {
  canInvite: boolean;
  canResendInvite: boolean;
  canEditAccess: boolean;
  canAssignLocations: boolean;
  canDeactivate: boolean;
  canRemove: boolean;
};

export type ClientUsersResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  /** No client-user directory is exposed by the backend. */
  | { status: "unavailable"; reason: string; capabilities: ClientUserCapabilities }
  | { status: "no_users"; roles: ClientUserRole[]; capabilities: ClientUserCapabilities }
  | {
      status: "ready";
      users: ClientUser[];
      roles: ClientUserRole[];
      capabilities: ClientUserCapabilities;
    };

const DEMO_CAPABILITIES: ClientUserCapabilities = {
  canInvite: true,
  canResendInvite: true,
  canEditAccess: true,
  canAssignLocations: true,
  canDeactivate: true,
  canRemove: true,
};

export function getClientUserCapabilities(real?: ClientUserCapabilities | null): ClientUserCapabilities {
  return withDemoFallback(real, () => DEMO_CAPABILITIES);
}

/**
 * The live agency account-management backend is not connected in this
 * frontend, so this falls back to a deterministic demo access directory for
 * the requested client.
 */
export function getClientUsers(clientId: string, real?: ClientUsersResult | null): ClientUsersResult {
  return withDemoFallback(real, () => {
    const users = demoClientUsers(clientId);
    const resolved = users.length > 0 ? users : demoClientUsersFallback(clientId);
    if (resolved.length === 0) {
      return { status: "no_users", roles: DEMO_CLIENT_USER_ROLES, capabilities: DEMO_CAPABILITIES };
    }
    return { status: "ready", users: resolved, roles: DEMO_CLIENT_USER_ROLES, capabilities: DEMO_CAPABILITIES };
  });
}

export const CLIENT_USER_STATUS_LABEL: Record<ClientUserStatus, string> = {
  active: "Active",
  invited: "Invited",
  pending: "Pending",
  suspended: "Suspended",
};

export const CLIENT_USER_STATUS_TONE: Record<ClientUserStatus, "success" | "info" | "warning" | "critical"> = {
  active: "success",
  invited: "info",
  pending: "warning",
  suspended: "critical",
};

export const CLIENT_USERS_PAGE_SIZE = 10;
