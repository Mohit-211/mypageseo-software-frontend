/**
 * Signed-in user profile and account settings.
 *
 * Only fields the account layer works with today are exposed: name, email
 * (with its verification state), phone, job title and personal timezone.
 * Security operations (password change, two-factor, avatar upload, account
 * deletion) belong to the authentication service, which is not connected to
 * this frontend, so their capabilities are reported as unsupported rather
 * than simulated.
 *
 * Real payloads always win; the demo profile is only used while the account
 * backend is unavailable. Remove the demo fallback once it is connected.
 */

import { withDemoFallback } from "./demo/demo-mode";
import { DEMO_USER_PROFILE } from "./demo/profile";

export type EmailVerificationState = "verified" | "unverified" | "unknown";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  emailVerification: EmailVerificationState;
  /** Null when the user has not added a phone number. */
  phone: string | null;
  /** Null when the user has not added a job title. */
  jobTitle: string | null;
  /** IANA timezone used to present dates for this user. */
  timezone: string;
  /** Confirmed avatar URL, null when the user has no uploaded image. */
  avatarUrl: string | null;
};

export type ProfileCapabilities = {
  canEditProfile: boolean;
  canSaveProfile: boolean;
  canUploadAvatar: boolean;
  canResendEmailVerification: boolean;
  canChangePassword: boolean;
  canManageTwoFactor: boolean;
  canSignOut: boolean;
  canDeleteAccount: boolean;
};

export type ProfileResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; profile: UserProfile; capabilities: ProfileCapabilities };

export const PROFILE_NAME_MAX_LENGTH = 80;
export const JOB_TITLE_MAX_LENGTH = 60;

export type ProfileFormValues = {
  name: string;
  phone: string;
  jobTitle: string;
  timezone: string;
};

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>;

export function getUserProfile(real?: ProfileResult | null): ProfileResult {
  return withDemoFallback(real, () => DEMO_USER_PROFILE());
}

export function profileToForm(profile: UserProfile): ProfileFormValues {
  return {
    name: profile.name,
    phone: profile.phone ?? "",
    jobTitle: profile.jobTitle ?? "",
    timezone: profile.timezone,
  };
}

export function validateProfile(values: ProfileFormValues): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Enter your name.";
  else if (name.length > PROFILE_NAME_MAX_LENGTH)
    errors.name = `Use ${PROFILE_NAME_MAX_LENGTH} characters or fewer.`;

  const phone = values.phone.trim();
  if (phone && !/^[+]?[\d\s().-]{7,20}$/.test(phone)) errors.phone = "Enter a valid phone number.";

  if (values.jobTitle.trim().length > JOB_TITLE_MAX_LENGTH)
    errors.jobTitle = `Use ${JOB_TITLE_MAX_LENGTH} characters or fewer.`;

  if (!values.timezone) errors.timezone = "Select a timezone.";
  return errors;
}

export function profileFormsAreEqual(a: ProfileFormValues, b: ProfileFormValues): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.phone.trim() === b.phone.trim() &&
    a.jobTitle.trim() === b.jobTitle.trim() &&
    a.timezone === b.timezone
  );
}

export function profileInitials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}
