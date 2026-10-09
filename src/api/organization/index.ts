import { api, unwrapData } from "../client";
import type {
  InvitationStatus,
  OrganizationCountry,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationResponse,
  OrganizationRole,
  OrganizationUsage,
} from "../types/organization";

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

export async function getOrganization(signal?: AbortSignal): Promise<OrganizationResponse> {
  return unwrapData(await api.get("organization", withSignal(signal)));
}

/** Owner only (403 otherwise). */
export async function updateOrganization(patch: { name?: string; country?: OrganizationCountry }): Promise<OrganizationResponse> {
  return unwrapData(await api.patch("organization", patch));
}

export async function getOrganizationUsage(signal?: AbortSignal): Promise<OrganizationUsage> {
  return unwrapData(await api.get("organization/usage", withSignal(signal)));
}

/** Owner and member. */
export async function getOrganizationMembers(signal?: AbortSignal): Promise<OrganizationMember[]> {
  return unwrapData(await api.get("organization/members", withSignal(signal)));
}

/** Owner only. The owner is protected: 403 `owner_protected`. */
export async function updateOrganizationMember(
  userId: string,
  body: { role: Exclude<OrganizationRole, "owner">; client_ids?: string[] },
): Promise<{ user_id: string; role: OrganizationRole; client_ids: string[] }> {
  return unwrapData(await api.patch(`organization/members/${encodeURIComponent(userId)}`, body));
}

export async function removeOrganizationMember(userId: string): Promise<{ removed: boolean; user_id: string }> {
  return unwrapData(await api.delete(`organization/members/${encodeURIComponent(userId)}`));
}

/** Owner only. 409 `already_member`, 403 `user_limit_reached` / `agency_only`, 429 above 20 an hour. Re-inviting a pending email sends a new link. */
export async function createInvitation(body: {
  email: string;
  role: Exclude<OrganizationRole, "owner">;
  client_ids?: string[];
}): Promise<OrganizationInvitation> {
  return unwrapData(await api.post("organization/invitations", body));
}

export async function getInvitations(status?: InvitationStatus, signal?: AbortSignal): Promise<OrganizationInvitation[]> {
  return unwrapData(await api.get("organization/invitations", { ...(status ? { query: { status } } : {}), ...withSignal(signal) }));
}

export async function revokeInvitation(invitationId: string): Promise<{ revoked: boolean; invitation_id: string }> {
  return unwrapData(await api.delete(`organization/invitations/${encodeURIComponent(invitationId)}`));
}
