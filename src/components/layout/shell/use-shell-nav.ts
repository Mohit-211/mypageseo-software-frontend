import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "@/api";
import { useAccess } from "@/hooks/use-access";
import { activeNavFor, isLocationEntry, navigationFor, routeLocationIdFrom, type ActiveNav, type NavItem } from "@/lib/mypageseo/navigation";
import { pickNavLocationId } from "@/lib/mypageseo/section-links";
import { useWorkspace, type LocationSummary } from "@/lib/mypageseo/workspace";

/**
 * - `loading`: the location list hasn't arrived yet.
 * - `ready`: there is at least one location.
 * - `empty`: the organization has no locations yet.
 * - `unavailable`: the list couldn't be loaded.
 */
export type NavLocationState = "loading" | "ready" | "empty" | "unavailable";

export type NavLocation = {
  /** The location in the URL (`/locations/:id/…`), else null. */
  routeLocationId: string | null;
  /** The location that location links open: the URL's, else the remembered one, else the first. */
  navLocationId: string | null;
  navLocation: LocationSummary | null;
  state: NavLocationState;
};

/** The location the sidebar, the switcher and global search work with. */
export function useNavLocation(): NavLocation {
  const { pathname } = useLocation();
  const { status, locations, activeLocation } = useWorkspace();
  const routeLocationId = routeLocationIdFrom(pathname);
  const picked = pickNavLocationId({
    routeLocationId,
    activeLocationId: activeLocation?.id,
    locationIds: locations.map((location) => location.id),
  });
  // While the list loads, a location page already knows its location, so its links work at once.
  const navLocationId = picked ?? (status === "loading" ? routeLocationId : null);
  const navLocation = navLocationId ? (locations.find((location) => location.id === navLocationId) ?? null) : null;
  const state: NavLocationState =
    locations.length > 0 ? "ready" : status === "loading" ? "loading" : status === "unavailable" ? "unavailable" : "empty";
  return { routeLocationId, navLocationId, navLocation, state };
}

export type ShellNavigation = NavLocation & {
  /** The menu items this user sees, in order. */
  items: NavItem[];
  /** The current entry, or null on pages the menu doesn't list (Settings, Help …). */
  active: ActiveNav | null;
  /** False until the organization (and so the account type and role) is known. */
  accountKnown: boolean;
  /** Why location pages are unavailable when there is no location to open them for. */
  noLocationReason: string;
};

/** Everything the sidebar needs: visible items, the current entry and the location in context. */
export function useShellNavigation(): ShellNavigation {
  const { pathname } = useLocation();
  const { organization } = useWorkspace();
  const access = useAccess();
  const items = navigationFor(organization?.accountType ?? "business", access.can);
  const location = useNavLocation();
  const active = activeNavFor(items, pathname);
  // A location the list doesn't have (not found, or no access): the location links open the
  // switcher's location instead, so none of them is the page on screen.
  const elsewhere = location.routeLocationId !== null && location.navLocationId !== location.routeLocationId;
  const activeItem = active ? items.find((item) => item.id === active.itemId) : undefined;
  return {
    ...location,
    items,
    active: elsewhere && activeItem && isLocationEntry(activeItem) ? null : active,
    accountKnown: Boolean(organization),
    noLocationReason:
      location.state === "unavailable"
        ? "Locations didn't load"
        : access.can("workspace.edit")
          ? "Add a location first"
          : "No locations yet",
  };
}

/** Signs out, drops the previous user's cached data and opens the sign-in page. */
export function useSignOut(): () => Promise<void> {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    try {
      await logout();
    } finally {
      // Drop the previous user's cached data so the next sign-in starts clean.
      queryClient.clear();
      navigate("/login", { replace: true });
    }
  }, [navigate, queryClient]);
}

/** Up to two initials for an avatar chip ("Harbor Dental – Downtown" → "HD"). */
export function initialsOf(name: string, fallback = "?"): string {
  const words = name
    .split(/[\s–—-]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return initials || fallback;
}

/** Preload handlers for a link: the page's code starts downloading on hover, focus or touch. */
export function preloadHandlers(preload: () => void) {
  return { onPointerEnter: preload, onFocus: preload, onTouchStart: preload };
}
