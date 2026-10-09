/** Organization settings, usage and team (Phases 8, 11, 13a): `/organization*`. */

export type OrganizationType = "business" | "agency";
export type OrganizationRole = "owner" | "member" | "client_user";
/** The product covers the US and Canada only. */
export type OrganizationCountry = "US" | "CA";

/** `GET organization`. */
export type OrganizationResponse = {
  organization: { id: string; name: string; type: OrganizationType; country: OrganizationCountry | string | null; created_at: string | null };
  role: OrganizationRole;
  memberships: { organization_id: string; name: string; type: OrganizationType; role: OrganizationRole }[];
};

/** `GET organization/usage`. `limit: null` means no cap. */
export type OrganizationUsage = {
  plan: { id: string; name: string; kind: string } | null;
  billing: { state: string; read_only: boolean; trial_ends_at: string | null; current_period_end: string | null } | null;
  locations: { used: number; limit: number | null; max?: number | null };
  users?: { used: number; limit: number | null };
  tokens?: { balance: number };
  keywords: { used: number; limit: number | null };
  /** Null for a business. */
  clients: { used: number } | null;
};

/** `GET organization/members` row. */
export type OrganizationMember = {
  user_id: string;
  name: string | null;
  email: string;
  role: OrganizationRole;
  client_ids: string[];
  status: string;
  invited_by?: string | null;
  joined_at?: string | null;
};

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type OrganizationInvitation = {
  invitation_id: string;
  email: string;
  role: Exclude<OrganizationRole, "owner">;
  client_ids: string[];
  status: InvitationStatus;
  expires_at: string;
  invited_by: string | null;
  created_at: string;
  email_sent?: boolean;
};
