import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSearchUpdater, type HistoryState } from "@/lib/url-state";

/**
 * URL state of White Label and Reports:
 * - `?client=<clientId>`, `?location=<locationId>`: narrow the page (links from a client or a location);
 * - `?link=<locationId>`: the client link drawer;
 * - `?create=report|schedule`: a create dialog (`/reports/create` lands here), cleared on close;
 * - `?edit=brand`: the brand editor open.
 */
export type PageParams = {
  client: string | null;
  location: string | null;
  link: string | null;
  create: "report" | "schedule" | null;
  edit: "brand" | null;
};

const KEYS = ["client", "location", "link", "create", "edit"] as const;

function read(search: string): PageParams {
  const params = new URLSearchParams(search);
  const create = params.get("create");
  return {
    client: params.get("client") || null,
    location: params.get("location") || null,
    link: params.get("link") || null,
    create: create === "report" || create === "schedule" ? create : null,
    edit: params.get("edit") === "brand" ? "brand" : null,
  };
}

/**
 * Reads and updates those params. Updates keep the `#section` and the scroll position (opening or
 * closing the drawer never jumps the page; see `useSearchUpdater`), and replace the history entry
 * unless `push` is set (the drawer, so Back closes it).
 */
export function usePageParams(): [PageParams, (patch: Partial<PageParams>, options?: { push?: boolean; state?: HistoryState }) => void] {
  const { search } = useLocation();
  const updateSearch = useSearchUpdater();
  const params = useMemo(() => read(search), [search]);

  const update = useCallback(
    (patch: Partial<PageParams>, options: { push?: boolean; state?: HistoryState } = {}) => {
      updateSearch(
        (next) => {
          for (const key of KEYS) {
            if (!(key in patch)) continue;
            const value = patch[key];
            if (value) next.set(key, value);
            else next.delete(key);
          }
        },
        { push: Boolean(options.push), ...(options.state === undefined ? {} : { state: options.state }) },
      );
    },
    [updateSearch],
  );

  return [params, update];
}
