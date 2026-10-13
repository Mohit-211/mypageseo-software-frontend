import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { getSelectedOrganizationId, isApiError, setSelectedOrganizationId } from "@/api";
import { noteAccountError } from "@/lib/billing/account-restriction";

function onError(error: unknown) {
  noteAccountError(error);
  // 403 `not_a_member`: the stored organization isn't the user's any more; fall back to the default one.
  if (isApiError(error) && error.reason === "not_a_member" && getSelectedOrganizationId()) {
    setSelectedOrganizationId(null);
    void queryClient.invalidateQueries();
  }
}

/** Every failed call is checked for an account restriction (suspended / read-only) for the shell banner. */
export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    // Pages read stored data that changes only after a refresh (and writes invalidate what they
    // change), so coming back to a page within 30 s reuses what's loaded instead of refetching.
    queries: { staleTime: 30_000 },
  },
});
