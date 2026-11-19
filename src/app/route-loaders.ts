/**
 * Route loaders. Address rewrites run here, before anything renders, so an old or
 * convenience URL never paints an empty frame on its way to the real page. Redirects that
 * depend on the workspace (which location, which role) are small pages under
 * `src/pages/redirects/` instead, so they render inside the shell while the workspace loads.
 *
 * Every rewrite replaces the address it came from (`replace`, not `redirect`): a forwarding
 * address never stays in the history, so Back leaves the page instead of landing on the old
 * address and being sent forward again (`/`, `/login` when signed in, bookmarks of old pages).
 */
import { replace, type LoaderFunctionArgs, type Params, type ShouldRevalidateFunction } from "react-router-dom";
import { getSelectedOrganizationId, hasUsableSession } from "@/api";
import { getPostLoginPath } from "@/lib/auth/auth-session";
import { gbpReportQuery } from "@/lib/gbp/use-gbp-report";
import { locationOverviewQuery, locationQuery } from "@/lib/locations/use-locations";
import { withSearchAndHash } from "@/lib/mypageseo/section-links";
import { postsSummaryQuery } from "@/lib/posts/use-posts";
import { rankTrackerQuery, trackingQuery } from "@/lib/rankings/use-rankings";
import { reviewsSummaryQuery } from "@/lib/reviews/use-reviews";
import { organizationParam } from "./organization-link";
import { queryClient } from "./query-client";

/** Loader for a fixed new address (`?search` and `#hash` of the old one are dropped). */
export function toPath(path: string) {
  return () => replace(path);
}

/**
 * Loader for a new address built from the old one's params, keeping its `?search` (the new
 * address's own parameters and hash win).
 */
export function toParams(build: (params: Params) => string) {
  return ({ params, request }: LoaderFunctionArgs) => replace(withSearchAndHash(build(params), { search: new URL(request.url).search }));
}

/** `/`: the app has no landing page; a usable session goes straight in, anyone else signs in. */
export function indexLoader() {
  return replace(hasUsableSession() ? getPostLoginPath(null) : "/login");
}

/**
 * Sign in / Sign up for someone already signed in (a bookmark, the back button): straight into
 * the app, decided before the page renders so the form never flashes.
 */
export function guestOnlyLoader() {
  return hasUsableSession() ? replace(getPostLoginPath(null)) : null;
}

/** How long opening a location not loaded yet keeps the current page up while its header loads. */
const LOCATION_HEADER_WAIT_MS = 250;

/**
 * Every page of one location: start its data in parallel with the page code (the loader runs
 * while the route files download). `prefetchQuery` skips data that is still fresh and never
 * throws, so failures reach the pages' own error states.
 *
 * A location not loaded before (first visit, or switching to another location) keeps the
 * current page on screen for up to 250 ms while its header arrives, so the new page usually
 * opens complete instead of as a full-page skeleton. It never waits longer, and never when the
 * header is already known (moving between a location's pages).
 *
 * A link into another organization (`?organization=`, from an email) prefetches nothing: the page waits
 * until the tab has switched (./organization-link.ts), and asking now would ask the wrong organization.
 * Dropping the parameter is a search-only change, so the loader doesn't run again: the page loads its data.
 */
export async function locationLoader({ params, request }: LoaderFunctionArgs) {
  const locationId = params.locationId;
  if (!locationId || !hasUsableSession()) return null;
  const linked = organizationParam(new URL(request.url).search);
  if (linked && linked !== getSelectedOrganizationId()) return null;
  const header = locationQuery(locationId);
  const known =
    queryClient.getQueryData(header.queryKey) !== undefined ||
    queryClient.getQueryData(locationOverviewQuery(locationId).queryKey) !== undefined;
  const headerLoaded = queryClient.prefetchQuery(header);
  void queryClient.prefetchQuery(locationOverviewQuery(locationId));
  void queryClient.prefetchQuery(rankTrackerQuery(locationId));
  void queryClient.prefetchQuery(trackingQuery(locationId));
  void queryClient.prefetchQuery(gbpReportQuery(locationId, "28d"));
  void queryClient.prefetchQuery(reviewsSummaryQuery(locationId));
  // GET posts/summary answers for every location (it carries `connection.gbp_connected`), but the
  // overview only reads it once Google is connected, which the header says; the posts pages load it
  // themselves either way.
  void headerLoaded.then(() => {
    if (queryClient.getQueryData(header.queryKey)?.gbp_connected) void queryClient.prefetchQuery(postsSummaryQuery(locationId));
  });
  if (!known) await Promise.race([headerLoaded, new Promise((resolve) => window.setTimeout(resolve, LOCATION_HEADER_WAIT_MS))]);
  return null;
}

/** Re-run a prefetch loader only when the page changes, not for filters, tabs or `?run=`. */
export const unlessSearchOnly: ShouldRevalidateFunction = ({ currentUrl, nextUrl, defaultShouldRevalidate }) =>
  currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate;
