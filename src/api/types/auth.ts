/**
 * Request and response shapes for the authentication endpoints.
 *
 * Request types mirror the fields the auth screens already collect and
 * validate (see pages/auth). Adjust the response types to match the backend
 * contract once it is final.
 */
import type { AccountType } from "@/lib/mypageseo/navigation";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  accountType: AccountType;
  organizationId: string;
  organizationName: string;
};

export type AuthSession = {
  accessToken: string;
  /** ISO timestamp when the access token expires. */
  expiresAt?: string;
  user: AuthUser;
};

/** Generic acknowledgement for endpoints that return no data. */
export type MessageResponse = {
  message: string;
};

/** Backend account type sent as `user_type` on signup. */
export type UserType = "BUSINESS" | "AGENCY";

/** Payload for `POST user/auth/register`, in the backend's field names. */
export type SignupRequest = {
  name: string;
  email: string;
  mobile: string;
  user_type: UserType;
  password: string;
  confirm_password: string;
  /** Location ids come from the location lookup endpoints (see api/location). */
  country_id: string;
  state_id: string;
  city_id: string;
  business_address: string;
  website_url: string;
  business_name: string;
  zip_code: string;
};

/**
 * Register may sign the user in straight away or ask them to verify first, so
 * the token is optional. Tighten this once the backend contract is final.
 */
export type SignupResponse = {
  message?: string;
  accessToken?: string;
  data?: unknown;
};

export type LoginRequest = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

/** A JWT plus its ISO expiry timestamp, as the backend returns them. */
export type AuthToken = {
  token: string;
  expires: string;
};

/** `data` of a successful `POST user/auth/login`. */
export type LoginData = {
  name: string;
  email: string;
  user_type: UserType;
  role_id: number;
  tokens: {
    access: AuthToken;
    refresh: AuthToken;
  };
};

export type LoginResponse = {
  success: boolean;
  status: number;
  message: string;
  data: LoginData;
};

/** Access/refresh pair; refresh may be omitted if the backend doesn't rotate it. */
export type AuthTokens = {
  access: AuthToken;
  refresh?: AuthToken;
};

/**
 * Response of the refresh endpoint. Accepts the tokens nested like login
 * (`data.tokens`) or directly under `data`; tighten once the contract is final.
 */
export type RefreshTokenResponse = {
  success?: boolean;
  status?: number;
  message?: string;
  data?: { tokens: AuthTokens } | AuthTokens;
};

export type ForgotPasswordRequest = {
  email: string;
  password: string;
  confirm_password: string;
  token: string;
};

/** Payload for `POST user/auth/reset-password`; `token` comes from verify-otp. */
export type ResetPasswordRequest = {
  email: string;
  password: string;
  confirm_password: string;
  token: string;
};

export type VerifyEmailRequest = {
  token: string;
};

export type VerifyEmailResponse = {
  status: "verified" | "already_verified";
};

export type ResendVerificationRequest = {
  email: string;
};

/** What a one-time code is for; the backend needs it on OTP requests. */
export type OtpType = "EMAIL_VERIFICATION" | "FORGOT_PASSWORD" | "RESET_PASSWORD";

/** Payload for `POST user/auth/verify-otp`. */
export type VerifyOtpRequest = {
  email: string;
  otp: string;
  type: OtpType;
};

export type VerifyOtpResponse = {
  success?: boolean;
  message?: string;
  accessToken?: string;
  /** For FORGOT_PASSWORD / RESET_PASSWORD this is the token reset-password expects. */
  data?: unknown;
};

/** Payload for `POST user/auth/otp` (resend code). */
export type SendOtpRequest = {
  email: string;
  type: OtpType;
};
