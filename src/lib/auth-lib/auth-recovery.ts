/**
 * Authentication recovery contracts.
 *
 * These mirror what the Mypageseo authentication service exposes for password
 * recovery and email verification: an enumeration-safe reset request, a
 * token-scoped password reset, and a token-scoped verification result.
 *
 * While the authentication service is not connected to this frontend, the
 * resolvers below fall back to the shared demo layer (see demo/demo-mode.ts)
 * so the flows can be reviewed end to end. Removing the fallback does not
 * change any component.
 */
import { z } from "zod";
import { withDemoFallback } from "../mypageseo/demo/demo-mode";

/** State of a password-reset token supplied through the reset link. */
export type ResetTokenState = "valid" | "invalid" | "expired";

/** State of an email-verification token supplied through the verify link. */
export type VerificationState =
  | "verified"
  | "already_verified"
  | "invalid"
  | "expired";

/** Password rules enforced by the authentication service (same as signup). */
export const passwordSchema = z
  .string()
  .min(8, { message: "Use at least 8 characters." })
  .max(128, { message: "Password must be under 128 characters." })
  .regex(/[A-Za-z]/, { message: "Include at least one letter and one number." })
  .regex(/[0-9]/, { message: "Include at least one letter and one number." });

export const resetEmailSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter your email address." })
  .email({ message: "Enter a valid email address." })
  .max(255, { message: "Email must be under 255 characters." });

export type AuthRecoveryCapabilities = {
  /** Request a password-reset email. */
  requestPasswordReset: boolean;
  /** Submit a new password against a reset token. */
  resetPassword: boolean;
  /** Resend a verification email for an unverified address. */
  resendVerification: boolean;
};

export function authRecoveryCapabilities(
  real?: AuthRecoveryCapabilities | null,
): AuthRecoveryCapabilities {
  return withDemoFallback(real, () => ({
    requestPasswordReset: true,
    resetPassword: true,
    resendVerification: true,
  }));
}

/**
 * Resolves a token state. The real service validates the token server-side;
 * the demo fallback is deterministic on the token string so every state can be
 * reviewed (`...-expired`, `...-invalid`, empty/missing token → invalid).
 */
export function resolveResetTokenState(
  token: string | undefined,
  real?: ResetTokenState | null,
): ResetTokenState {
  return withDemoFallback(real, () => {
    if (!token || token.trim().length < 8) return "invalid";
    if (token.includes("expired")) return "expired";
    if (token.includes("invalid")) return "invalid";
    return "valid";
  });
}

export function resolveVerificationState(
  token: string | undefined,
  real?: VerificationState | null,
): VerificationState {
  return withDemoFallback(real, () => {
    if (!token || token.trim().length < 8) return "invalid";
    if (token.includes("expired")) return "expired";
    if (token.includes("invalid")) return "invalid";
    if (token.includes("already")) return "already_verified";
    return "verified";
  });
}
