import { resolveAccountRestriction, useAccountRestriction, useOrganizationUsage } from "@/lib/billing/use-billing";

export type WriteBlock = {
  /** True when billing-gated actions would be refused (402 `subscription_required` / 403 `organization_suspended`). */
  blocked: boolean;
  state: "read_only" | "suspended" | null;
  /** Why the action is off, for a tooltip or a note next to it. */
  reason: string | null;
};

const SUSPENDED: WriteBlock = {
  blocked: true,
  state: "suspended",
  reason: "This account is suspended. Contact support to restore it.",
};
const READ_ONLY: WriteBlock = {
  blocked: true,
  state: "read_only",
  reason: "Your account is read-only until it has an active subscription.",
};
const OPEN: WriteBlock = { blocked: false, state: null, reason: null };

/**
 * Whether the account can do the things that need billing (the backend's `requireBilling`): manual
 * refreshes (rankings, Google data), creating or changing a client link, creating or emailing a
 * report, creating or changing a monthly email. Turning a link off, archiving, sharing and deleting
 * a schedule keep working, as do every read and the brand itself.
 * Read from `GET organization/usage` (every role) and from refusals already seen, with the same rule
 * as the shell's account banner (`resolveAccountRestriction`).
 */
export function useWriteBlock(): WriteBlock {
  const usage = useOrganizationUsage();
  const seen = useAccountRestriction();
  const restriction = resolveAccountRestriction(usage.data?.billing, seen);
  return restriction === "suspended" ? SUSPENDED : restriction === "read_only" ? READ_ONLY : OPEN;
}
