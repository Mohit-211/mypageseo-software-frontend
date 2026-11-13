import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import {
  getSelectedOrganizationId,
  getSessionSubject,
  hasUsableSession,
  isApiError,
  setSelectedOrganizationId,
  subscribeToAccessToken,
  subscribeToSelectedOrganization,
} from "@/api";
import {
  getAccountRestriction,
  noteAccountError,
  resetAccountRestriction,
  subscribeToAccountRestriction,
} from "@/lib/billing/account-restriction";

function onError(error: unknown) {
  noteAccountError(error);
  // 403 `not_a_member`: the picked organization isn't the user's any more; fall back to the default one
  // (the organization listener below resets its data) and re-read which organizations the user has.
  if (isApiError(error) && error.reason === "not_a_member" && getSelectedOrganizationId()) {
    setSelectedOrganizationId(null);
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  }
}

/** Every failed call is checked for an account restriction (suspended / read-only) for the shell banner. */
export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      // Pages read stored data that changes only after a refresh (and writes invalidate what they
      // change), so coming back to a page within 30 s reuses what's loaded instead of refetching.
      staleTime: 30_000,
      // A page visited earlier in the session (up to 30 min ago) opens with its last data at once
      // and refreshes it in the background, instead of a skeleton.
      gcTime: 30 * 60_000,
    },
  },
});

/**
 * This tab's organization changed (picked in the menu, opened from an invitation, or reset by a
 * sign-in, another user's session or a lost membership): everything cached, and any refusal seen,
 * belongs to the previous one. The profile (which organizations the user has) stays. Skipped while
 * signed out: sign-out clears the cache itself, and refetching now would go out without a token.
 */
const stopOrganizationWatch = subscribeToSelectedOrganization(() => {
  if (!hasUsableSession()) return;
  resetAccountRestriction();
  void queryClient.resetQueries({ predicate: (query) => query.queryKey[0] !== "profile" });
});

/**
 * Another user's session replaced this one without a sign-out in between: an invitation or
 * email-verification link opened while signed in, here or in another tab (kept sessions are
 * shared). Nothing cached is theirs, so start clean in their default organization. A renewal
 * keeps the same user and changes nothing; sign-out (no user) is handled by WorkspaceProvider.
 */
let sessionUser = getSessionSubject();
const stopSessionWatch = subscribeToAccessToken(() => {
  const next = getSessionSubject();
  if (next === sessionUser) return;
  const previous = sessionUser;
  sessionUser = next;
  if (previous && next) {
    queryClient.clear();
    resetAccountRestriction();
    setSelectedOrganizationId(null);
  }
});

/**
 * A refusal was noted (here, or by a call made outside the query cache, such as a manual refresh):
 * read the account's billing state again now. `GET organization/usage` is the authority, so the
 * remembered refusal is only a hint until it answers (it never fails with these reasons, so this
 * can't loop). Re-armed only when the hint changes, not on every refusal.
 */
const stopRestrictionWatch = subscribeToAccountRestriction(() => {
  if (getAccountRestriction()) void queryClient.invalidateQueries({ queryKey: ["organization", "usage"] });
});

// Editing this file in development re-runs it: drop the old watchers rather than stacking them.
import.meta.hot?.dispose(() => {
  stopOrganizationWatch();
  stopSessionWatch();
  stopRestrictionWatch();
});
