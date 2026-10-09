/**
 * Signed-in user profile (`GET/PATCH auth/me`). The backend stores the name and
 * mobile number; the email and its verification come from the account itself.
 * Password change and account deletion live in `AccountSecurity`.
 */

import type { Profile, UpdateProfileRequest } from "@/api/types/profile";

export type EmailVerificationState = "verified" | "unverified" | "unknown";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  emailVerification: EmailVerificationState;
  /** Null when the user has not added a phone number. */
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
};

export type ProfileResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: UserProfile };

export const PROFILE_NAME_MAX_LENGTH = 80;

export type ProfileFormValues = {
  name: string;
  phone: string;
};

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>;

export function profileToForm(profile: UserProfile): ProfileFormValues {
  return { name: profile.name, phone: profile.phone ?? "" };
}

export function validateProfile(values: ProfileFormValues): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Enter your name.";
  else if (name.length > PROFILE_NAME_MAX_LENGTH)
    errors.name = `Use ${PROFILE_NAME_MAX_LENGTH} characters or fewer.`;

  const phone = values.phone.trim();
  if (phone && !/^[+]?[\d\s().-]{7,20}$/.test(phone)) errors.phone = "Enter a valid phone number.";
  return errors;
}

export function profileFormsAreEqual(a: ProfileFormValues, b: ProfileFormValues): boolean {
  return a.name.trim() === b.name.trim() && a.phone.trim() === b.phone.trim();
}

export function profileInitials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

/** Maps the `auth/me` payload to the profile the settings screen works with. */
export function toUserProfile(profile: Profile): UserProfile {
  // `email_verified_at` is the current field (null = not verified); the booleans are older shapes.
  const verified =
    profile.email_verified_at !== undefined
      ? profile.email_verified_at !== null
      : (profile.email_verified ?? profile.is_email_verified);
  return {
    id: profile.id ?? profile._id ?? "",
    name: profile.name ?? "",
    email: profile.email ?? "",
    emailVerification: verified === undefined ? "unknown" : verified ? "verified" : "unverified",
    phone: profile.mobile ?? null,
    lastLoginAt: profile.last_login_at ?? null,
    createdAt: profile.created_at ?? null,
  };
}

/** Builds the `PATCH auth/me` body from the validated form values. */
export function toUpdateProfileRequest(values: ProfileFormValues): UpdateProfileRequest {
  return {
    name: values.name.trim(),
    mobile: values.phone.trim() || null,
  };
}
