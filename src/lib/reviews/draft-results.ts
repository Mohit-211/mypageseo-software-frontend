/**
 * Drafting or analyzing several reviews (Phase 25b, 2026-11-17), as pure helpers and one runner.
 *
 * - A drafts or Analyze request takes at most `ai.draft_all_max` ids (6 by default, a server setting: more is 400
 *   `invalid_input`), and each can take up to about 75 s. A bigger selection goes in chunks, one after the other
 *   (`runInChunks`), with one progress bar for all of them.
 * - Reviews the AI didn't draft come back in `skipped` with a reason (`summarizeDraftRun` groups them):
 *   `deadline` (not written in time: nothing used, "Draft it again"), `draft_changed` (a person changed the draft
 *   meanwhile: theirs is kept), the AI's reasons (`ai_failed`, `ai_budget_reached`, `ai_org_budget_reached`,
 *   `ai_not_configured`), and the old ones (`flagged`, `already_replied`, `no_rating`, `not_found`,
 *   `deleted_on_google`; Analyze: `no_text`). `insufficient_tokens` is no longer one (2026-11-17): a 402 comes
 *   before anything is drafted.
 */
import type { StatusTone } from "@/components/layout/shared/module-tone";
import type { Review } from "@/api";
import { reviewerName } from "./send-results";

export type DraftRunKind = "drafts" | "analyze";

export type DraftSkipKey =
  | "deadline"
  | "ai_failed"
  | "ai_paused"
  | "ai_off"
  | "draft_changed"
  | "flagged"
  | "already_replied"
  | "no_rating"
  | "no_text"
  | "deleted_on_google"
  | "not_found"
  | "other";

const SKIP_KEY: Record<string, DraftSkipKey> = {
  deadline: "deadline",
  ai_failed: "ai_failed",
  ai_budget_reached: "ai_paused",
  ai_org_budget_reached: "ai_paused",
  ai_not_configured: "ai_off",
  draft_changed: "draft_changed",
  flagged: "flagged",
  suspicious: "flagged",
  already_replied: "already_replied",
  no_rating: "no_rating",
  no_text: "no_text",
  deleted_on_google: "deleted_on_google",
  not_found: "not_found",
};

type SkipCopy = {
  title: string;
  /** What happened and what to do, for the group. */
  hint: string;
  /** The same for one review (a card's toast). */
  one: string;
  tone: StatusTone;
  /** Trying again may work: "Draft them again". */
  retry: boolean;
};

const DRAFT_SKIP_COPY: Record<DraftSkipKey, SkipCopy> = {
  deadline: {
    title: "Not written in time",
    hint: "The AI ran out of time on these, so nothing was used. Draft them again.",
    one: "The AI ran out of time on this reply, so nothing was used. Draft it again.",
    tone: "warning",
    retry: true,
  },
  ai_failed: {
    title: "The AI couldn't write a usable reply",
    hint: "Nothing was used. Try them again.",
    one: "The AI couldn't write a usable reply, so nothing was used. Try again.",
    tone: "warning",
    retry: true,
  },
  ai_paused: {
    title: "AI is paused for today",
    hint: "Today's AI limit was reached, so nothing was used. Draft them tomorrow, or write the replies yourself.",
    one: "AI is paused for today, so nothing was used. Try again tomorrow, or write the reply yourself.",
    tone: "info",
    retry: false,
  },
  ai_off: {
    title: "AI isn't switched on yet",
    hint: "Nothing was used. You can write these replies yourself.",
    one: "AI isn't switched on yet. You can write this reply yourself.",
    tone: "info",
    retry: false,
  },
  draft_changed: {
    title: "Changed by someone meanwhile",
    hint: "A person changed these drafts while the AI was writing. Their version is kept, and nothing was used.",
    one: "Someone changed this draft while the AI was writing. Their version is kept, and nothing was used.",
    tone: "neutral",
    retry: false,
  },
  flagged: {
    title: "Suspicious indicators",
    hint: "AI doesn't reply to these. Ask Google to remove them instead.",
    one: "AI doesn't reply to reviews with suspicious indicators. Ask Google to remove it instead.",
    tone: "neutral",
    retry: false,
  },
  already_replied: {
    title: "Already answered",
    hint: "These have a reply on Google now.",
    one: "This review has a reply on Google now.",
    tone: "neutral",
    retry: false,
  },
  no_rating: {
    title: "No star rating",
    hint: "AI replies need a star rating. You can write these yourself.",
    one: "AI replies need a star rating. You can write this one yourself.",
    tone: "neutral",
    retry: false,
  },
  no_text: {
    title: "No text to analyze",
    hint: "Only reviews with text can be analyzed.",
    one: "Only reviews with text can be analyzed.",
    tone: "neutral",
    retry: false,
  },
  deleted_on_google: {
    title: "Deleted on Google",
    hint: "These are no longer on Google, so there's nothing to reply to.",
    one: "This review is no longer on Google.",
    tone: "neutral",
    retry: false,
  },
  not_found: {
    title: "Not found",
    hint: "They may have been removed since the list loaded.",
    one: "This review isn't here anymore. Reload the page.",
    tone: "neutral",
    retry: false,
  },
  other: {
    title: "Not drafted",
    hint: "Try them again from their reviews.",
    one: "AI didn't draft a reply to this review.",
    tone: "neutral",
    retry: false,
  },
};

/** Analyze words where they differ from the drafts'. */
const ANALYZE_SKIP_COPY: Partial<Record<DraftSkipKey, Partial<SkipCopy>>> = {
  deadline: { hint: "The AI ran out of time on these, so nothing was used. Analyze them again.", one: "The AI ran out of time, so nothing was used. Try again." },
  ai_failed: { title: "The AI couldn't analyze these", one: "The AI couldn't analyze this review, so nothing was used. Try again." },
  ai_paused: { hint: "Today's AI limit was reached, so nothing was used. Try again tomorrow." },
  ai_off: { hint: "Nothing was used." },
  other: { title: "Not analyzed", one: "AI didn't analyze this review." },
};

const ORDER: readonly DraftSkipKey[] = [
  "deadline",
  "ai_failed",
  "ai_paused",
  "ai_off",
  "draft_changed",
  "flagged",
  "already_replied",
  "no_rating",
  "no_text",
  "deleted_on_google",
  "not_found",
  "other",
];

function copyOf(key: DraftSkipKey, kind: DraftRunKind): SkipCopy {
  const base = DRAFT_SKIP_COPY[key];
  return kind === "analyze" ? { ...base, ...ANALYZE_SKIP_COPY[key] } : base;
}

export function draftSkipKey(reason: string | null | undefined): DraftSkipKey {
  return (reason && SKIP_KEY[reason]) || "other";
}

/** Why the AI didn't draft (or analyze) one review, in one or two sentences (a card's toast). */
export function draftSkipText(reason: string | null | undefined, kind: DraftRunKind = "drafts"): { text: string; retry: boolean } {
  const copy = copyOf(draftSkipKey(reason), kind);
  return { text: copy.one, retry: copy.retry };
}

export type DraftSkipItem = { reviewId: string; reviewer: string; rating: number | null };

export type DraftSkipGroup = {
  key: DraftSkipKey;
  title: string;
  hint: string;
  tone: StatusTone;
  /** "Draft them again" applies. */
  retry: boolean;
  items: DraftSkipItem[];
};

export type DraftRunResult = {
  kind: DraftRunKind;
  /** Reviews asked for. */
  requested: number;
  /** Drafted (`generated`) or analyzed now. */
  done: number;
  /** Already current, reused for free. */
  reused: number;
  /** The tokens of the blocks the requests bought and kept (usually 0). */
  tokensSpent: number;
  groups: DraftSkipGroup[];
  /** The reviews worth trying again (`deadline`, `ai_failed`). */
  retryIds: string[];
  /** An error that stopped the run after earlier chunks worked (what they did is kept), else null. */
  stopped: unknown;
  /** Reviews not asked for because of that stop. */
  notTried: string[];
};

type ChunkAnswer = {
  /** `generated` (drafts) or `analyzed`. */
  done: number;
  reused: number;
  tokensSpent: number;
  skipped: readonly { review_id: string; reason: string }[];
};

/** What a run of drafts or Analyze requests did, grouped for the results panel. `reviews`: the reviews asked about, for names. */
export function summarizeDraftRun(
  kind: DraftRunKind,
  requested: readonly string[],
  answers: readonly ChunkAnswer[],
  reviews: readonly { review_id: string; reviewer?: Review["reviewer"] | undefined; rating?: Review["rating"] | undefined }[],
  stopped: unknown = null,
  notTried: readonly string[] = [],
): DraftRunResult {
  const byId = new Map(reviews.map((review) => [review.review_id, review]));
  const grouped = new Map<DraftSkipKey, DraftSkipItem[]>();
  for (const answer of answers) {
    for (const skip of answer.skipped) {
      const key = draftSkipKey(skip.reason);
      const review = byId.get(skip.review_id);
      const items = grouped.get(key) ?? [];
      if (!items.some((item) => item.reviewId === skip.review_id)) {
        items.push({ reviewId: skip.review_id, reviewer: reviewerName(review), rating: review?.rating ?? null });
      }
      grouped.set(key, items);
    }
  }
  const groups = ORDER.filter((key) => grouped.has(key)).map((key) => {
    const copy = copyOf(key, kind);
    return { key, title: copy.title, hint: copy.hint, tone: copy.tone, retry: copy.retry, items: grouped.get(key) ?? [] };
  });
  return {
    kind,
    requested: requested.length,
    done: answers.reduce((sum, answer) => sum + answer.done, 0),
    reused: answers.reduce((sum, answer) => sum + answer.reused, 0),
    tokensSpent: answers.reduce((sum, answer) => sum + answer.tokensSpent, 0),
    groups,
    retryIds: groups.filter((group) => group.retry).flatMap((group) => group.items.map((item) => item.reviewId)),
    stopped,
    notTried: [...notTried],
  };
}

/** Nothing to show beyond a toast: every review was drafted (or reused) and nothing stopped the run. */
export function draftRunClean(result: DraftRunResult): boolean {
  return result.groups.length === 0 && result.stopped === null && result.notTried.length === 0;
}

/** "6 replies drafted", "1 review analyzed", with what was reused. */
export function draftRunTitle(result: Pick<DraftRunResult, "kind" | "done" | "reused">): string {
  const noun = result.kind === "analyze" ? (result.done === 1 ? "review analyzed" : "reviews analyzed") : result.done === 1 ? "reply drafted" : "replies drafted";
  const main = `${result.done.toLocaleString()} ${noun}`;
  return result.reused > 0 ? `${main} (${result.reused.toLocaleString()} already up to date)` : main;
}

/** Splits ids into requests of at most `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const step = Math.max(1, Math.floor(size));
  const parts: T[][] = [];
  for (let index = 0; index < items.length; index += step) parts.push(items.slice(index, index + step));
  return parts;
}

export type ChunkProgress = {
  /** Reviews in the requests that answered. */
  done: number;
  total: number;
  /** Reviews in the request running now. */
  current: number;
  /** When the request running now started (ms). */
  startedAt: number;
};

/**
 * Calls `request` for each chunk of `ids` (at most `size` each), one after the other. The first request's error is
 * thrown (nothing was done); a later one stops the run and comes back as `stopped`, with the ids not asked for.
 * `onProgress` hears before each request and once at the end (`current` 0).
 */
export async function runInChunks<T>(
  ids: readonly string[],
  size: number,
  request: (chunkIds: string[]) => Promise<T>,
  onProgress?: (progress: ChunkProgress) => void,
): Promise<{ answers: T[]; stopped: unknown; notTried: string[] }> {
  const parts = chunk(ids, size);
  const answers: T[] = [];
  let done = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? [];
    onProgress?.({ done, total: ids.length, current: part.length, startedAt: Date.now() });
    try {
      answers.push(await request(part));
    } catch (error) {
      if (answers.length === 0) throw error;
      onProgress?.({ done, total: ids.length, current: 0, startedAt: Date.now() });
      return { answers, stopped: error, notTried: parts.slice(index).flat() };
    }
    done += part.length;
  }
  onProgress?.({ done, total: ids.length, current: 0, startedAt: Date.now() });
  return { answers, stopped: null, notTried: [] };
}
