/**
 * The organization the user is working in, sent as `X-Organization-Id` on every
 * request. Unset = the user's default organization (backend decides).
 */
const KEY = "mypageseo.organization";

export function getSelectedOrganizationId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setSelectedOrganizationId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Without storage the default organization is used.
  }
}
