/**
 * The Keywords page's address: `?keyword=` opens a keyword's details (global search and other pages
 * link there), `?group=` filters the table (shared with the ranking pages), `?band=` filters it by
 * rank band, `?sort=` / `?order=` order it. All of them replace the history entry, like the ranking
 * pages' filters, so Back leaves the page instead of undoing filters.
 *
 * A change keeps the page where it is, `#groups` included (`useSearchUpdater`), and is committed
 * before the setter returns, so "Show in list" and the band filters can scroll to the table right
 * after. Call the setters from event handlers.
 *
 * The keyword sheet is the exception: it is an overlay (full screen on phones), so opening it adds a
 * history entry and Back (or Android's back gesture) closes it instead of leaving the page.
 */
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { SortDirection } from "@/lib/sort";
import { isHistoryState, setParam, useSearchUpdater } from "@/lib/url-state";
import { BAND_ORDER, type KeywordBand } from "./bands";
import { KEYWORD_SORT_KEYS, type KeywordSortKey } from "./paths";
import { KEYWORD_SORT_FIRST_ORDER } from "./sort";

/** History state of the entry the keyword sheet added (see `openKeyword`). */
const KEYWORD_SHEET = "keywordSheet";

export function useKeywordsParams() {
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const location = useLocation();
  const navigate = useNavigate();

  const set = (updates: Record<string, string | null | undefined>) =>
    updateSearch(
      (next) => {
        for (const [key, value] of Object.entries(updates)) setParam(next, key, value);
      },
      { flushSync: true },
    );

  const sortParam = params.get("sort");
  const sort: KeywordSortKey = KEYWORD_SORT_KEYS.includes(sortParam as KeywordSortKey) ? (sortParam as KeywordSortKey) : "priority";
  const orderParam = params.get("order");
  const order: SortDirection = orderParam === "asc" || orderParam === "desc" ? orderParam : KEYWORD_SORT_FIRST_ORDER[sort];
  const bandParam = params.get("band");
  const band = BAND_ORDER.includes(bandParam as KeywordBand) ? (bandParam as KeywordBand) : null;

  return {
    keyword: params.get("keyword"),
    /** Opens a keyword's sheet on a new history entry, so Back closes it. */
    openKeyword: (keyword: string) =>
      updateSearch((next) => setParam(next, "keyword", keyword), { push: true, state: { [KEYWORD_SHEET]: true } }),
    /**
     * Leaves the sheet's address once it has slid closed: Back when opening it added the entry, else
     * (a link that landed on `?keyword=`, e.g. the global search) the same address without it.
     */
    closeKeyword: () => {
      if (isHistoryState(location.state) && location.state[KEYWORD_SHEET]) void navigate(-1);
      else updateSearch((next) => setParam(next, "keyword", null));
    },
    group: params.get("group"),
    setGroup: (group: string | null) => set({ group }),
    band,
    setBand: (next: KeywordBand | null) => set({ band: next }),
    sort,
    order,
    /** A new column starts in its natural direction; the same column flips. */
    onSort: (next: KeywordSortKey) => {
      const nextOrder: SortDirection = next === sort ? (order === "asc" ? "desc" : "asc") : KEYWORD_SORT_FIRST_ORDER[next];
      set({ sort: next === "priority" && nextOrder === "asc" ? null : next, order: nextOrder === KEYWORD_SORT_FIRST_ORDER[next] ? null : nextOrder });
    },
    setSort: (next: KeywordSortKey) => set({ sort: next === "priority" ? null : next, order: null }),
    clearFilters: () => set({ group: null, band: null }),
  };
}
