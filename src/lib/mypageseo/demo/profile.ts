/**
 * Demo profile for the signed-in user.
 *
 * Replace this file once the account backend returns the real profile.
 * Security capabilities stay false because the authentication service is not
 * connected to this frontend — they must not be simulated.
 */
import type { ProfileResult } from "../profile";

export function DEMO_USER_PROFILE(): ProfileResult {
  return {
    status: "ready",
    profile: {
      id: "usr_current",
      name: "Alina Petrov",
      email: "alina.petrov@northbounddigital.com",
      emailVerification: "verified",
      phone: "+1 (512) 555-0113",
      jobTitle: "Local SEO Lead",
      timezone: "America/Chicago",
      avatarUrl: null,
    },
    capabilities: {
      canEditProfile: true,
      canSaveProfile: true,
      // Avatar storage, verification email delivery, password, two-factor and
      // account deletion all require the authentication service.
      canUploadAvatar: false,
      canResendEmailVerification: false,
      canChangePassword: false,
      canManageTwoFactor: false,
      canSignOut: true,
      canDeleteAccount: false,
    },
  };
}
