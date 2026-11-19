/**
 * `?organization=<id>` on a signed-in page (backend guide, 2026-11-17 entry, section 6). Every link the backend
 * puts in an email or a redirect to a page inside an organization carries it: billing emails and PayPal's return
 * (`/settings/billing?checkout=success&organization=…`), a ticket reply, a post Google rejected, the weekly
 * automatic-replies email and the AI review digest.
 *
 * On load, when the user belongs to that organization, this tab switches to it (as the organization menu does:
 * the requests' `X-Organization-Id`, and app/query-client.ts drops the other organization's data), and the
 * parameter is dropped: the entry is replaced, and the path, the other parameters and the `#section` stay.
 * Otherwise it is dropped silently and the page opens in the current organization.
 *
 * Until that is decided the page waits (`AppRoot` shows the loading screen instead of the page), so nothing on it
 * loads, writes or remembers anything in the wrong organization: PayPal's return syncs or captures at once, and a
 * location page would otherwise ask the other organization for the location first. Deciding needs `GET auth/me`
 * (which organizations the user has), the first request of every signed-in page anyway; a link to the tab's
 * current organization waits for nothing. Signed out, nothing happens here: the sign-in redirect keeps the whole
 * address (`from`), so the switch happens after signing in.
 */
import { useEffect, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSelectedOrganizationId, hasUsableSession, subscribeToAccessToken, subscribeToSelectedOrganization } from "@/api";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { isHistoryState } from "@/lib/url-state";

export const ORGANIZATION_PARAM = "organization";

/** History state flag of the entry that replaced a link's address without `?organization=` (see `HashScroll`). */
const FROM_ORGANIZATION_LINK = "fromOrganizationLink";

/** The organization a link asks for (`?organization=`), or null. */
export function organizationParam(search: string): string | null {
  const value = new URLSearchParams(search).get(ORGANIZATION_PARAM)?.trim();
  return value ? value : null;
}

/** `search` without `organization` (every other parameter kept, in order), with its "?" when anything is left. */
export function withoutOrganizationParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(ORGANIZATION_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

/**
 * True for the entry that only dropped a link's `?organization=`: to the reader it is still the page the link
 * opened, so its `#section` is followed as on a first load (a search-only change otherwise keeps the scroll).
 */
export function isOrganizationLinkHop(state: unknown): boolean {
  return isHistoryState(state) && state[FROM_ORGANIZATION_LINK] === true;
}

/**
 * Follows a link's `?organization=` (see the file comment). Returns true while the page should wait: the
 * parameter is in the address, someone is signed in, and whether they belong to it isn't known yet. When
 * `GET auth/me` fails the page isn't held: it opens in the current organization, and the switch still happens if
 * a retry answers while the parameter is there.
 */
export function useOrganizationFromLink(): boolean {
  const location = useLocation();
  const navigate = useNavigate();
  const signedIn = useSyncExternalStore(subscribeToAccessToken, hasUsableSession, () => false);
  const selectedId = useSyncExternalStore(subscribeToSelectedOrganization, getSelectedOrganizationId, () => null);
  const { organizations, organizationsLoaded, status, setOrganizationId } = useWorkspace();
  const wanted = organizationParam(location.search);
  // Already this tab's organization: there is nothing to switch, so nothing to wait for.
  const decided = wanted !== null && (organizationsLoaded || wanted === selectedId);

  useEffect(() => {
    if (!wanted || !signedIn || !decided) return;
    if (organizations.some((org) => org.id === wanted)) setOrganizationId(wanted);
    const state = isHistoryState(location.state) ? location.state : {};
    void navigate(
      { pathname: location.pathname, search: withoutOrganizationParam(location.search), hash: location.hash },
      { replace: true, preventScrollReset: true, state: { ...state, [FROM_ORGANIZATION_LINK]: true } },
    );
  }, [wanted, signedIn, decided, organizations, setOrganizationId, navigate, location]);

  return Boolean(wanted && signedIn && status !== "unavailable");
}
