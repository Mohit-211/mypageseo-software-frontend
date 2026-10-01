/**
 * Request and response shapes for `/api/v1/auth` (docs/backend/API.md "Auth").
 * Email verification and password reset are by emailed link; there are no codes.
 */
import type { AccountType } from "@/lib/mypageseo/navigation";

/** Backend account type on the user (`user_type`). */
export type UserType = "BUSINESS" | "AGENCY";

/** A JWT plus its ISO expiry timestamp, as the backend returns them. */
export type AuthToken = {
  token: string;
  expires: string;
};

/** Access/refresh pair. Both rotate on refresh. */
export type AuthTokens = {
  access: AuthToken;
  refresh?: AuthToken;
};

export type SessionOrganization = {
  organization_id: string;
  name: string;
  type: AccountType;
  role: string;
};

/** The organization's onboarding steps, as returned with a session. */
export type SessionOnboarding = {
  id: string;
  type: AccountType;
  steps: { id: string; status: string }[];
  next_step: string | null;
  completed: boolean;
  completed_at: string | null;
};

/** A signed-in session: login, first email verification, invitation accept. */
export type AuthSession = {
  tokens: AuthTokens;
  user: { id: string; email: string; name: string; user_type: UserType };
  organizations: SessionOrganization[];
  current_organization_id: string | null;
  onboarding: SessionOnboarding | null;
};

/** `POST auth/signup`, in the backend's field names. */
export type SignupRequest = {
  account_type: AccountType;
  name: string;
  email: string;
  password: string;
  organization_name: string;
  country: "US" | "CA";
  accept_terms: true;
};

/** `POST auth/signup` → 201: nothing is signed in until the email link is opened. */
export type SignupResult = {
  user_id: string;
  organization_id: string;
  email_verification: "sent";
  verify_before: string;
};

export type LoginRequest = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

/** `POST auth/verify-email`: a session the first time; no tokens when the link was used before. */
export type VerifyEmailResult =
  | ({ verified: true; already_verified: false } & AuthSession)
  | { verified: true; already_verified: true };

export type ResetPasswordRequest = {
  token: string;
  password: string;
  confirm_password: string;
};

/** `POST auth/invitations/inspect`. */
export type InvitationInfo = {
  organization: { name: string; type: AccountType };
  email: string;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  account_exists: boolean;
};

/** `POST auth/invitations/accept`: a new account is signed in; an existing one must log in. */
export type InvitationAcceptResult =
  | ({ accepted: true; organization_id: string; login_required: false } & AuthSession)
  | { accepted: true; organization_id: string; login_required: true };
