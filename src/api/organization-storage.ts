/**
 * The organization this tab works in, sent as `X-Organization-Id` on every
 * request. Unset = the user's default organization (backend decides).
 *
 * One value per tab, kept in memory: the request header (api/client.ts) and the UI
 * (WorkspaceProvider, through `subscribeToSelectedOrganization`) read the same
 * one, so the organization on screen is always the one requests act on. Each pick
 * is also saved in localStorage so a reload or a new tab starts from it, but other
 * tabs' picks are deliberately not followed: switching in one tab must not move
 * another tab's requests (and writes) to an organization it isn't showing.
 */
const KEY = "mypageseo.organization";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let current: string | null = readStored();
const listeners = new Set<() => void>();

export function getSelectedOrganizationId(): string | null {
  return current;
}

/**
 * Picks this tab's organization (`null` = the default one) and remembers it for the next tab or reload.
 * The remembered pick is shared by every tab and written on each call, even when this tab's value
 * doesn't change, so a sign-in or a sign-out resets it for the tabs to come. Call it for a pick, a
 * sign-in or a sign-out only, never because a tab merely opened signed out (WorkspaceProvider).
 */
export function setSelectedOrganizationId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Without storage the pick lasts until the tab closes.
  }
  if (id === current) return;
  current = id;
  for (const listener of listeners) listener();
}

/** Calls `listener` whenever this tab's organization changes. */
export function subscribeToSelectedOrganization(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
