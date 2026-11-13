/**
 * Address-bar state of the current page (filters, views, open drawers in `?search`) and how the
 * page keeps its scroll position.
 *
 * Scroll positions are remembered per history entry (`scrollRestorationKey`, App.tsx):
 * - a link or a redirect to a page opens it at the top, or at its `#section`;
 * - Back and Forward put the reader back where they were on that entry;
 * - a change of `?search` made with `useSearchUpdater` stays on the same entry for scrolling, so a
 *   filter, a sort or a page number never moves the page (or jumps to the `#section` in the address).
 *   A handler that wants to show the result passes `flushSync` and scrolls right after.
 */
import { useCallback } from "react";
import { useLocation, useNavigate, type Location } from "react-router-dom";

export type HistoryState = Record<string, unknown>;

/** Where a search-only change records the scroll entry it belongs to, in the history state. */
const SCROLL_ENTRY = "scrollEntry";

export function isHistoryState(value: unknown): value is HistoryState {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The key a scroll position is remembered under (ScrollRestoration's `getKey`): the history entry
 * the reader is on. A search-only change carries its entry's key in the history state, so it shares
 * the position of the entry it came from. The first page of a tab has no key of its own yet
 * ("default"), so first pages are told apart by address: typing another address in the same tab
 * never opens it at the last one's position.
 */
export function scrollRestorationKey(location: Pick<Location, "key" | "state" | "pathname" | "hash">): string {
  const entry = isHistoryState(location.state) ? location.state[SCROLL_ENTRY] : undefined;
  if (typeof entry === "string" && entry) return entry;
  return location.key === "default" ? `default:${location.pathname}${location.hash}` : location.key;
}

/** History state for a change that stays on this page: `state` plus the current entry's scroll key. */
export function keepScrollEntry(location: Pick<Location, "key" | "state" | "pathname" | "hash">, state?: HistoryState): HistoryState {
  return { ...state, [SCROLL_ENTRY]: scrollRestorationKey(location) };
}

export type SearchUpdateOptions = {
  /** Add a history entry, so Back undoes the change (an open drawer). Default: replace the current one. */
  push?: boolean;
  /**
   * Commit the new address before returning, so the handler can scroll to the result right after
   * ("filter and show"), and a controlled input bound to the address keeps every keystroke and its
   * caret. Call it from event handlers only: React defers a flush asked for inside an effect.
   */
  flushSync?: boolean;
  /** History state of the new entry (the scroll entry is added to it). */
  state?: HistoryState;
};

/** Edits the current `?search` in place (or returns a replacement). */
export type SearchChange = (params: URLSearchParams) => URLSearchParams | void;

/**
 * Changes the current page's `?search` and nothing else: the path and the `#section` stay, the
 * scroll position stays (see above), and the history entry is replaced unless `push` is set.
 * Changes build on the address of the last render, so two changes in one handler should be one call.
 */
export function useSearchUpdater(): (change: SearchChange, options?: SearchUpdateOptions) => void {
  const location = useLocation();
  const navigate = useNavigate();
  return useCallback(
    (change: SearchChange, options: SearchUpdateOptions = {}) => {
      const current = new URLSearchParams(location.search);
      const next = change(current) ?? current;
      const search = next.toString();
      void navigate(
        { pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash },
        {
          replace: !options.push,
          preventScrollReset: true,
          state: keepScrollEntry(location, options.state),
          ...(options.flushSync ? { flushSync: true } : {}),
        },
      );
    },
    [location, navigate],
  );
}

/** One `?name=value` setter: an empty value removes the parameter. */
export function setParam(params: URLSearchParams, name: string, value: string | null | undefined): void {
  if (value) params.set(name, value);
  else params.delete(name);
}
