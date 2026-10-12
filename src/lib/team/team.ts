import { apiErrorData, isApiError } from "@/api";

export const TEAM_KEY = ["organization", "team"] as const;

export function inviteErrorText(err: unknown): string {
  if (!isApiError(err)) return "The invitation couldn't be sent. Try again.";
  const data = apiErrorData(err);
  switch (err.reason) {
    case "already_member":
      return "That person is already in this organization.";
    case "user_limit_reached":
      return `You've reached your user limit (${String(data.used ?? "?")} of ${String(data.limit ?? "?")}). Each paid location includes 3 users, the owner included.`;
    case "agency_only":
      return "Client users are for agency accounts.";
    case "owner_only":
      return "Only the account owner can invite people.";
    case "rate_limited":
      return "Too many invitations this hour. Try again later.";
    default:
      return err.status === 400 && err.message ? err.message : "The invitation couldn't be sent. Try again.";
  }
}
