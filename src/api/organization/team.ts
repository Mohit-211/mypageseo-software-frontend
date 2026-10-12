import { api, unwrapData } from "../client";

export type MemberRole = "owner" | "member" | "client_user";

export type OrganizationMember = {
  user_id: string;
  name: string;
  email: string;
  role: MemberRole;
  /** `member`: the clients it's limited to (`[]` = all clients). `client_user`: its clients. */
  client_ids: string[];
  /** Phase 21: true for a member limited to its clients, and for every client_user. */
  restricted?: boolean;
  status: string;
  invited_by?: string | null;
  joined_at?: string | null;
};

export type Invitation = {
  invitation_id: string;
  email: string;
  role: Exclude<MemberRole, "owner">;
  client_ids: string[];
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  invited_by: string | null;
  created_at: string;
  email_sent?: boolean;
};

export type OrganizationInfo = {
  organization: { id: string; name: string; type: "business" | "agency"; country: "US" | "CA" | string; created_at: string };
  role: MemberRole;
  /** Phase 21: a member limited to `client_ids` (also true for a client_user). */
  restricted?: boolean;
  client_ids?: string[];
  memberships: { organization_id: string; name: string; type: string; role: MemberRole }[];
};

export type OrganizationUsage = {
  plan: { id: string; name: string; kind: string } | null;
  /** Readable by every role (client_user included): drives the trial / read-only banner. */
  billing: {
    state: "trialing" | "active" | "past_due" | "inactive" | "suspended_by_admin" | string;
    read_only: boolean;
    trial_ends_at: string | null;
    current_period_end: string | null;
    grace_ends_at?: string | null;
  };
  locations: { used: number; limit: number; max: number };
  users: { used: number; limit: number };
  tokens: { balance: number };
  keywords: { used: number; limit: number | null };
  clients: { used: number } | null;
  api_usage?: unknown;
};

const listOf = <T,>(value: T[] | Record<string, T[]>, key: string): T[] => (Array.isArray(value) ? value : (value[key] ?? []));

export async function getOrganization(signal?: AbortSignal): Promise<OrganizationInfo> {
  return unwrapData(await api.get("organization", signal ? { signal } : {}));
}

/** Owner only. */
export async function updateOrganization(patch: { name?: string; country?: "US" | "CA" }): Promise<OrganizationInfo> {
  return unwrapData(await api.patch("organization", patch));
}

export async function getOrganizationUsage(signal?: AbortSignal): Promise<OrganizationUsage> {
  return unwrapData(await api.get("organization/usage", signal ? { signal } : {}));
}

export async function getMembers(signal?: AbortSignal): Promise<OrganizationMember[]> {
  return listOf(unwrapData<OrganizationMember[] | Record<string, OrganizationMember[]>>(await api.get("organization/members", signal ? { signal } : {})), "members");
}

export async function getInvitations(status?: Invitation["status"], signal?: AbortSignal): Promise<Invitation[]> {
  return listOf(
    unwrapData<Invitation[] | Record<string, Invitation[]>>(await api.get("organization/invitations", { query: { status }, ...(signal ? { signal } : {}) })),
    "invitations",
  );
}

/**
 * Owner only. 409 `already_member`; 403 `user_limit_reached { used, limit }`, `agency_only`;
 * 429 above 20 an hour. A client_user invitation needs `client_ids`.
 */
export async function inviteMember(input: { email: string; role: "member" | "client_user"; client_ids?: string[] }): Promise<Invitation> {
  // A member with `client_ids` is limited to those clients; omitted / [] = all clients.
  return unwrapData(await api.post("organization/invitations", input));
}

export async function revokeInvitation(invitationId: string): Promise<unknown> {
  return unwrapData(await api.delete(`organization/invitations/${encodeURIComponent(invitationId)}`));
}

/** 403 `owner_protected` for the owner. For a member, `client_ids: []` gives access to all clients again. */
export async function updateMember(
  userId: string,
  patch: { role: "member" | "client_user"; client_ids?: string[] },
): Promise<{ user_id: string; role: MemberRole; client_ids: string[]; restricted?: boolean }> {
  return unwrapData(await api.patch(`organization/members/${encodeURIComponent(userId)}`, patch));
}

export async function removeMember(userId: string): Promise<unknown> {
  return unwrapData(await api.delete(`organization/members/${encodeURIComponent(userId)}`));
}
