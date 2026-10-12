import { useQuery } from "@tanstack/react-query";
import { getBillingSummary, getOrganizationUsage } from "@/api";
import { useWorkspace } from "@/lib/mypageseo/workspace";

export const BILLING_QUERY_KEY = ["billing", "summary"] as const;

/** `GET billing` for owners and members (a client_user has no billing access). */
export function useBilling() {
  const { organization } = useWorkspace();
  const enabled = Boolean(organization) && organization?.role !== "client_user";
  return useQuery({
    queryKey: [...BILLING_QUERY_KEY, organization?.id ?? null],
    queryFn: ({ signal }) => getBillingSummary(signal),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * `GET organization/usage`: limits plus the billing state (`state`, `read_only`, trial / grace dates).
 * Every role can read it, so the account banner uses it rather than `GET billing`.
 */
export function useOrganizationUsage() {
  const { organization } = useWorkspace();
  return useQuery({
    queryKey: ["organization", "usage", organization?.id ?? null],
    queryFn: ({ signal }) => getOrganizationUsage(signal),
    enabled: Boolean(organization),
    staleTime: 60_000,
    retry: false,
  });
}

export { noteAccountError, resetAccountRestriction, useAccountRestriction, type AccountRestriction } from "./account-restriction";
