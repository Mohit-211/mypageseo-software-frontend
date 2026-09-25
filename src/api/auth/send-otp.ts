import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { MessageResponse, SendOtpRequest } from "../types/auth";

/** Sends a fresh one-time verification code to the given email. */
export function sendOtp(payload: SendOtpRequest): Promise<MessageResponse> {
  return api.post<MessageResponse>(ENDPOINTS.auth.sendOtp, payload, { auth: false });
}
