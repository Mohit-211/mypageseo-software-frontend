/**
 * Words for what can go wrong with an auto-post series (Phase 25c and the 2026-11-17 follow-ups): saving it, "Write
 * the next post now" (at once, and on its run), a slot's `last_error`. Reasons this file doesn't know fall back to
 * the posts copy (`postErrorText`) and, for AI, tokens and billing, the AI copy deck (`useToastPostError` →
 * `toastAiError`), so tokens get "Buy tokens" for owners and the account banner hears about billing.
 *
 * Generate next (docs/apps/CUSTOMER_APP.md, 2026-11-17 section 5 item 11): at once 404 `series_not_found`, 409
 * `series_paused` / `no_slots`, 402 `insufficient_tokens`, 503 `ai_*` / `run_not_queued`; on the run the slot's own
 * error (`insufficient_tokens`, `ai_budget_reached`, `ai_failed`, `no_topic`, `topic_not_available`, `series_changed`)
 * and the codes every run can end with. The old 409 without a run and the 502 with a reason are gone.
 *
 * Never "server": people read "isn't switched on yet" or "on our side".
 */
import { toast } from "sonner";
import { apiErrorData, isApiError } from "@/api";
import { useToastPostError, type PostErrorToastOptions } from "./post-toasts";
import { postErrorText } from "./use-posts";

export type SeriesErrorWords = {
  message: string;
  /** How the toast looks: an error, or a calm note (a pause, a limit). */
  tone?: "error" | "info";
  /** The series changed, paused or went: read it again. */
  reload?: boolean;
};

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

/** The words for a series reason, or null when the shared posts / AI copy says it better. */
export function seriesErrorWords(error: unknown): SeriesErrorWords | null {
  if (!isApiError(error)) return null;
  const data = apiErrorData(error);
  switch (error.reason) {
    case "series_not_found":
      return { message: "This series was deleted meanwhile.", reload: true };
    case "series_paused":
      return { message: "This series is paused. Resume it first, then write the next post.", tone: "info", reload: true };
    case "no_slots":
      return { message: "This series has no dates left to post on. Change its days or its end date first." };
    case "series_changed":
      return { message: "The series changed while its next post was being written, so nothing was kept or spent.", reload: true };
    case "no_topic":
      return { message: "AI found nothing new to write about. Add facts about the business in AI Settings, or give the series its own topics." };
    case "topic_not_available":
      return { message: "Its topic was taken meanwhile. Nothing was spent; try again." };
    case "run_not_queued":
    case "enqueue_failed":
      return { message: "Couldn't start. Nothing was spent; try again." };
    case "ai_org_budget_reached":
      return { message: "AI is paused for your organization today; it resumes tomorrow.", tone: "info" };
    case "generation_in_progress":
      return { message: "AI is already working on this. Wait for it to finish, then try again.", tone: "info" };
    case "keyword_not_tracked": {
      const keywords = strings(data.keywords);
      return {
        message: keywords.length
          ? `A series can only use keywords this location tracks. Not tracked: ${keywords.join(", ")}.`
          : "A series can only use keywords this location tracks.",
      };
    }
    case "topics_required":
      return { message: "Add at least one topic, or let AI plan the topics." };
    case "too_many_series":
    case "series_limit_reached": {
      const limit = typeof data.limit === "number" ? data.limit : 3;
      return { message: `A location can have up to ${limit} active series. Pause or delete one first.` };
    }
    case "ends_before_start":
      return { message: "The end date must be after the start date." };
    case "no_days":
      return { message: "Pick at least one day of the week." };
    case "gbp_not_connected":
      return { message: "Connect this location to Google first." };
    case "timed_out":
      return { message: "It couldn't start within an hour, so nothing was spent. Try again." };
    case "interrupted":
      return { message: "It was interrupted before it finished, so nothing was spent. Try again." };
    case "location_removed":
      return { message: "This location was removed." };
    case "access_removed":
      return { message: "You can't change this location's posts any more." };
    case "internal_error":
      return { message: "Something went wrong on our side. Nothing was spent; try again." };
    default:
      return null;
  }
}

export type SeriesErrorMessage = { message: string; buyTokens?: boolean; reload?: boolean };

/** A series error as one line for an inline note (a failed run's error included). Pure. */
export function seriesErrorMessage(error: unknown, fallback: string): SeriesErrorMessage {
  const words = seriesErrorWords(error);
  if (words) return { message: words.message, ...(words.reload ? { reload: true } : {}) };
  return postErrorText(error, fallback);
}

/**
 * Toasts a failed series action: the series' own words when it has them (then `onReload` when the series changed),
 * else the shared posts / AI toast.
 */
export function useToastSeriesError(): (error: unknown, fallback: string, options?: PostErrorToastOptions) => void {
  const toastPostError = useToastPostError();
  return (error, fallback, options = {}) => {
    const words = seriesErrorWords(error);
    if (!words) {
      toastPostError(error, fallback, options);
      return;
    }
    if (words.tone === "info") toast.info(words.message);
    else toast.error(words.message);
    if (words.reload) options.onReload?.();
  };
}
