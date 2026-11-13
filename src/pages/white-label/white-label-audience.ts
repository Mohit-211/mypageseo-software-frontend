import { useWhiteLabelAccess } from "@/lib/white-label/access";

/**
 * Who gets White Label and who gets Reports: `whiteLabel` for agency owners and members, else
 * Reports. `ready` is false until the workspace knows the account type. Kept for existing callers;
 * new code uses `useWhiteLabelAccess` (`@/lib/white-label/access`), which says more.
 */
export function useWhiteLabelAudience(): { ready: boolean; whiteLabel: boolean } {
  const access = useWhiteLabelAccess();
  return { ready: access.ready, whiteLabel: access.canWhiteLabel };
}
