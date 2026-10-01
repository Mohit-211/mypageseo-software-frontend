/**
 * Shared validation and error copy for the email-link auth flows
 * (signup, verify email, login, forgot / reset password, invitations).
 */
import { z } from "zod";
import { apiErrorData, isApiError } from "@/api";

/** The backend's password rule: 8–128 characters with a letter and a digit. */
export const passwordSchema = z
  .string()
  .min(8, { message: "Use at least 8 characters." })
  .max(128, { message: "Password must be under 128 characters." })
  .regex(/[A-Za-z]/, { message: "Include at least one letter and one number." })
  .regex(/[0-9]/, { message: "Include at least one letter and one number." });

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter your email address." })
  .email({ message: "Enter a valid email address." })
  .max(200, { message: "Email must be under 200 characters." });

/** "Try again in 12 minutes." for a 429 `rate_limited`, or null for other errors. */
export function rateLimitMessage(error: unknown): string | null {
  if (!isApiError(error) || (error.reason !== "rate_limited" && error.status !== 429)) return null;
  const seconds = Number(apiErrorData(error).retry_after_seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return "Too many attempts. Try again in a few minutes.";
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** Copy for unexpected failures (network, 5xx). */
export const GENERIC_AUTH_ERROR = "Something went wrong on our side. Please try again in a moment.";
