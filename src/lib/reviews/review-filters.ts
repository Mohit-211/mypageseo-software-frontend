/**
 * Review list filters kept in the address bar, so a reload, the back button and links from the
 * dashboard, AI Studio or an email open exactly the same view.
 *
 * Reviews page (`/locations/:id/reputation`):
 * - `?reply=needs|none|draft|sent|failed|pending|rejected`: the reply. "needs" = no reply on Google
 *   yet (no reply, a draft, a failed send, or a reply Google rejected); "draft" = a draft waits to be
 *   sent (failed sends included, they keep their draft); "none" = nothing written yet; "sent" = a
 *   reply is on Google (Phase 25a: published or still waiting for Google's review); "pending" =
 *   waiting for Google's review; "rejected" = Google rejected the reply (it isn't public).
 * - `?flag=attention|suspicious|any|none`: the review checks.
 * - `?deleted=1`: only the reviews deleted on Google (Phase 25a; read-only, left out of every other list).
 * - `?rating=1,2`: any of these star ratings.
 * - `?q=…`: words in the review or the reviewer's name.
 * - `?sort=newest|oldest|rating_asc|rating_desc`: newest first unless chosen otherwise.
 * - `?page=2`.
 *
 * AI Review Replies (`/locations/:id/ai/replies`): `?filter=none|drafts|rejected|low|attention|failed|suspicious`
 * (the reply queue preset, "none" by default) and `?page=`.
 *
 * Both pages: `?review=<id>` opens one review (scrolled to, or pinned above the list when it isn't
 * on the page); any change of filter or page closes it.
 *
 * Words, the same on every page: "Needs reply" = no reply on Google yet (the backend's `unreplied`,
 * drafts and rejected replies included); "No reply yet" = nothing written yet (unreplied minus drafts
 * and rejected replies, the AI queue); "urgent" = unanswered and 1–3 stars or flagged (the backend's
 * `awaiting_attention`).
 *
 * Every helper is pure; the hooks only read and write the address, replacing the history entry so
 * typing in the search box doesn't fill the back button. A change keeps the page where it is and is
 * committed before the setter returns (`useSearchUpdater` with `flushSync`): "show the list" handlers
 * can scroll right after, and the search box keeps every keystroke and its caret. Call the setters
 * from event handlers.
 */
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ReviewsQuery } from "@/api";
import { useSearchUpdater } from "@/lib/url-state";

export type ReplyFilter = "needs" | "none" | "draft" | "sent" | "failed" | "pending" | "rejected";
export type FlagFilter = "attention" | "suspicious" | "any" | "none";
export type ReviewSort = NonNullable<ReviewsQuery["sort"]>;

export type ReviewFilters = {
  reply: ReplyFilter | null;
  flag: FlagFilter | null;
  /** Only the reviews deleted on Google (a read-only list). */
  deleted: boolean;
  /** Star ratings, highest first. */
  ratings: number[];
  /** The search box as typed (the list query debounces it). */
  q: string;
  sort: ReviewSort;
  page: number;
};

const REPLY_FILTERS: readonly ReplyFilter[] = ["needs", "none", "draft", "sent", "failed", "pending", "rejected"];

/** `?review=<id>`: the review opened from a send's results or a link. */
export const REVIEW_SPOTLIGHT_PARAM = "review";
const FLAG_FILTERS: readonly FlagFilter[] = ["attention", "suspicious", "any", "none"];
const SORTS: readonly ReviewSort[] = ["newest", "oldest", "rating_asc", "rating_desc"];

export const DEFAULT_REVIEW_SORT: ReviewSort = "newest";

/** Longest search kept in the address: the API rejects a search longer than 100 characters. */
export const MAX_REVIEW_SEARCH = 100;
const MAX_SEARCH = MAX_REVIEW_SEARCH;

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | null =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;

const pageOf = (value: string | null): number => {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
};

/** The Reviews page filters from the address (unknown values fall back to "no filter"). */
export function parseReviewFilters(params: URLSearchParams): ReviewFilters {
  const ratings = [
    ...new Set(
      (params.get("rating") ?? "")
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5),
    ),
  ].sort((a, b) => b - a);
  const deleted = params.get("deleted");
  return {
    reply: pick(params.get("reply"), REPLY_FILTERS),
    flag: pick(params.get("flag"), FLAG_FILTERS),
    deleted: deleted === "1" || deleted === "true",
    ratings,
    q: (params.get("q") ?? "").slice(0, MAX_SEARCH),
    sort: pick(params.get("sort"), SORTS) ?? DEFAULT_REVIEW_SORT,
    page: pageOf(params.get("page")),
  };
}

/** `current` with the filter keys replaced by `filters` (defaults are left out; other keys are kept). */
export function writeReviewFilters(current: URLSearchParams, filters: ReviewFilters): URLSearchParams {
  const next = new URLSearchParams(current);
  const set = (key: string, value: string | null) => (value ? next.set(key, value) : next.delete(key));
  set("reply", filters.reply);
  set("flag", filters.flag);
  set("deleted", filters.deleted ? "1" : null);
  set("rating", filters.ratings.length ? [...filters.ratings].sort((a, b) => b - a).join(",") : null);
  set("q", filters.q ? filters.q.slice(0, MAX_SEARCH) : null);
  set("sort", filters.sort === DEFAULT_REVIEW_SORT ? null : filters.sort);
  set("page", filters.page > 1 ? String(filters.page) : null);
  return next;
}

/** True when anything narrows the list (the sort and the page don't). */
export function hasReviewFilters(filters: Pick<ReviewFilters, "reply" | "flag" | "ratings" | "q"> & { deleted?: boolean }): boolean {
  return filters.reply !== null || filters.flag !== null || Boolean(filters.deleted) || filters.ratings.length > 0 || filters.q.trim() !== "";
}

/** Every filter off (the sort is kept), as a patch for the setter. */
export function noReviewFilters(): Pick<ReviewFilters, "reply" | "flag" | "deleted" | "ratings" | "q"> {
  return { reply: null, flag: null, deleted: false, ratings: [], q: "" };
}

const REPLY_QUERY: Record<ReplyFilter, Pick<ReviewsQuery, "replied" | "reply_state" | "has_draft">> = {
  needs: { replied: false },
  none: { reply_state: "none" },
  draft: { has_draft: true, replied: false },
  // Phase 25a: a reply waiting for Google's review is on Google too (`replied=true` = sent or pending),
  // so the list matches its count (total minus unreplied).
  sent: { replied: true },
  failed: { reply_state: "failed" },
  pending: { reply_state: "pending" },
  rejected: { reply_state: "rejected" },
};

/** The `GET reviews` filter for these filters (without page and limit). `search` is the debounced text. */
export function reviewFiltersQuery(filters: ReviewFilters, search: string): Omit<ReviewsQuery, "page" | "limit"> {
  const text = search.trim();
  return {
    ...(filters.reply ? REPLY_QUERY[filters.reply] : {}),
    ...(filters.flag ? { flagged: filters.flag } : {}),
    ...(filters.deleted ? { deleted_on_google: true } : {}),
    ...(filters.ratings.length ? { rating: filters.ratings.join(",") } : {}),
    ...(text ? { search: text } : {}),
    sort: filters.sort,
  };
}

export const REPLY_FILTER_LABEL: Record<ReplyFilter, string> = {
  needs: "Needs reply",
  none: "No reply yet",
  draft: "Draft waiting",
  sent: "Replied",
  failed: "Send failed",
  pending: "Waiting for Google",
  rejected: "Rejected by Google",
};

export const DELETED_FILTER_LABEL = "Deleted on Google";

export const FLAG_FILTER_LABEL: Record<FlagFilter, string> = {
  attention: "Needs attention",
  suspicious: "Suspicious indicators",
  any: "Any flag",
  none: "Not flagged",
};

export const SORT_LABEL: Record<ReviewSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  rating_desc: "Highest rating",
  rating_asc: "Lowest rating",
};

export const REVIEW_SORTS = SORTS;

/**
 * The Reviews page filters and a setter that merges a change (back to page 1 unless `page` is given).
 * A change closes an open `?review=`.
 */
export function useReviewFilters(): [ReviewFilters, (patch: Partial<ReviewFilters>) => void] {
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const filters = useMemo(() => parseReviewFilters(params), [params]);
  const update = useCallback(
    (patch: Partial<ReviewFilters>) => {
      updateSearch(
        (current) => {
          const next = writeReviewFilters(current, { ...parseReviewFilters(current), page: 1, ...patch });
          next.delete(REVIEW_SPOTLIGHT_PARAM);
          return next;
        },
        { flushSync: true },
      );
    },
    [updateSearch],
  );
  return [filters, update];
}

/** Review ids are short tokens (24 hex characters today); anything else in the address is ignored. */
const SPOTLIGHT_ID = /^[\w-]{1,64}$/;

/**
 * `?review=<id>`: the review opened from a send's results (or a link), and a setter (null closes it).
 * The list scrolls to it, or pins it above the list when it isn't on the page.
 */
export function useReviewSpotlight(): [string | null, (reviewId: string | null) => void] {
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const value = params.get(REVIEW_SPOTLIGHT_PARAM)?.trim() ?? "";
  const reviewId = SPOTLIGHT_ID.test(value) ? value : null;
  const setReviewId = useCallback(
    (next: string | null) =>
      updateSearch(
        (current) => {
          if (next) current.set(REVIEW_SPOTLIGHT_PARAM, next);
          else current.delete(REVIEW_SPOTLIGHT_PARAM);
        },
        { flushSync: true },
      ),
    [updateSearch],
  );
  return [reviewId, setReviewId];
}

/* -------------------------------------------------------------------------- */
/* AI Review Replies: the reply queue                                          */
/* -------------------------------------------------------------------------- */

export type ReplyQueuePreset = "none" | "drafts" | "rejected" | "low" | "attention" | "failed" | "suspicious";

export type ReplyQueuePresetInfo = {
  id: ReplyQueuePreset;
  label: string;
  /** The chip's name for a client user, when `label` names something they can't see or do. */
  clientLabel?: string;
  /** One line under the chips explaining the view. */
  hint: string;
  /** The same line for a client user, who can't draft or send (their agency does); `hint` when left out. */
  clientHint?: string;
  query: Omit<ReviewsQuery, "page" | "limit" | "sort">;
};

/** The reply queue's views, in chip order. The list is always newest first. */
export const REPLY_QUEUE_PRESETS: readonly ReplyQueuePresetInfo[] = [
  {
    id: "none",
    label: "No reply yet",
    hint: "Reviews with no reply and no draft. Draft them all with AI above, or answer one at a time.",
    clientHint: "Reviews with no reply yet. Your agency drafts and sends the replies.",
    query: { reply_state: "none" },
  },
  {
    id: "drafts",
    label: "Drafts to check",
    // A client user never sees draft text, so there's nothing for them to check.
    clientLabel: "Being prepared",
    hint: "Read each draft, edit it if you like, then send it to Google.",
    // A client user never sees draft text: only the replies sent to Google.
    clientHint: "Reviews your agency is preparing a reply to. You'll see each reply once it's sent to Google.",
    query: { has_draft: true, replied: false },
  },
  {
    // Phase 25a: Google reviews every reply; these weren't published. Shown only when it has reviews.
    // A new draft on one moves it to "Drafts to check" (its card still says why the last was rejected).
    id: "rejected",
    label: "Rejected by Google",
    hint: "Google didn't publish these replies. Read Google's reason on each one, then draft a new reply and send it.",
    clientHint: "Google didn't publish these replies. Your agency writes new ones.",
    query: { reply_state: "rejected" },
  },
  {
    // Shown only when it has reviews. The urgent reviews ("1–3 stars or flagged") can't be one list:
    // the API ANDs its filters, so the flagged 4–5 star ones stay under "Needs attention".
    id: "low",
    label: "Low-rated",
    hint: "Unanswered reviews at 1–3 stars, drafts included: answer these first. Flagged reviews at 4–5 stars are under Needs attention.",
    clientHint: "Unanswered reviews at 1–3 stars, drafts included. Flagged reviews at 4–5 stars are under Needs attention.",
    query: { replied: false, rating: "1,2,3" },
  },
  {
    id: "attention",
    label: "Needs attention",
    hint: "Unanswered reviews our checks marked for a closer look, like a serious complaint or a repeat reviewer.",
    query: { flagged: "attention", replied: false },
  },
  {
    id: "failed",
    label: "Send failed",
    hint: "Google didn't accept these replies. Check the text and send again.",
    clientHint: "Google didn't accept these replies. Your agency checks the text and sends them again.",
    query: { reply_state: "failed" },
  },
  {
    id: "suspicious",
    label: "Suspicious",
    hint: "These may break Google's rules. Ask Google to remove them rather than replying.",
    clientHint: "These may break Google's rules. Your agency can ask Google to remove them rather than reply.",
    query: { flagged: "suspicious", replied: false },
  },
];

const PRESET_IDS = REPLY_QUEUE_PRESETS.map((preset) => preset.id);

export const DEFAULT_REPLY_QUEUE_PRESET: ReplyQueuePreset = "none";

export function replyQueuePreset(id: ReplyQueuePreset): ReplyQueuePresetInfo {
  return REPLY_QUEUE_PRESETS.find((preset) => preset.id === id) ?? REPLY_QUEUE_PRESETS[0]!;
}

/** The reply queue view and page from the address, and a setter (a new view starts at page 1). Both close an open `?review=`. */
export function useReplyQueueParams(): {
  preset: ReplyQueuePreset;
  page: number;
  setPreset: (preset: ReplyQueuePreset) => void;
  setPage: (page: number) => void;
} {
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const preset = pick(params.get("filter"), PRESET_IDS) ?? DEFAULT_REPLY_QUEUE_PRESET;
  const page = pageOf(params.get("page"));
  const setPreset = useCallback(
    (next: ReplyQueuePreset) =>
      updateSearch(
        (updated) => {
          if (next === DEFAULT_REPLY_QUEUE_PRESET) updated.delete("filter");
          else updated.set("filter", next);
          updated.delete("page");
          updated.delete(REVIEW_SPOTLIGHT_PARAM);
        },
        { flushSync: true },
      ),
    [updateSearch],
  );
  const setPage = useCallback(
    (next: number) =>
      updateSearch(
        (updated) => {
          if (next > 1) updated.set("page", String(next));
          else updated.delete("page");
          updated.delete(REVIEW_SPOTLIGHT_PARAM);
        },
        { flushSync: true },
      ),
    [updateSearch],
  );
  return { preset, page, setPreset, setPage };
}
