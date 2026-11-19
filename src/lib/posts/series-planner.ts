/**
 * Auto-post series (AI): whether the server's planner writes a series' posts on its own, and the words
 * for a series' problems. Pure; used by the series cards (`auto-posts.tsx`), the Posts page's
 * auto-posts card, and every summary that names "the next AI post" (AI Posts' Auto-posts tile, AI
 * Studio's AI Posts card): those go through `autoPostsState`, so a paused planner never shows one.
 *
 * `planner` (Phase 25a, on every series view): `on` = the hourly planner writes each post about 2 days
 * before its time; `switched_off` = MyPageSEO's rollout switch for automatic AI posts is off (until the
 * Phase 25 quality checks pass); `not_in_pilot` = it's on for some accounts only, not this one. Unless
 * it is `on`, nothing is generated for `next_slots`: they're only the times the series would use, so
 * never show them as "the next post". Creating, editing, previewing and "Write the next post now"
 * (`generate-next`) still work. Older servers leave `planner` out: that means on.
 *
 * Backend: docs/API.md "Auto-posts (series)" (`planner`, "Budget", "Rollout switch") and
 * docs/apps/CUSTOMER_APP.md "2026-11-13: Smaller changes".
 *
 * 2026-11-17 (G10): a series "needs attention" as the dashboard counts it (`posts:series_problem`,
 * `stats.series_problems`): a series that paused itself (`paused`) always; a failed slot (`last_error`) only while
 * the planner is `on`, since nothing tries it again while it is off and its error is stale (`seriesNeedsAttention`).
 */
import type { PostSeries, PostSeriesHistoryEntry } from "@/api";
import { formatResumeTime, nextUtcMidnight } from "@/lib/ai/ai-time";
import { heldLabel, seriesOutcomeLabel, type LabelTone } from "./approval-labels";

export type SeriesPlanner = "on" | "switched_off" | "not_in_pilot";
export type PausedPlanner = Exclude<SeriesPlanner, "on">;

/** The series button that writes the next post now (`generate-next`); it works whatever `planner` says. */
export const WRITE_NEXT_POST_LABEL = "Write the next post now";

/** A series' planner state. Missing (older servers) means on; an unknown value counts as paused. */
export function seriesPlanner(series: Pick<PostSeries, "planner">): SeriesPlanner {
  const planner = series.planner;
  if (planner == null || planner === "on") return "on";
  return planner === "not_in_pilot" ? "not_in_pilot" : "switched_off";
}

/** How automatic AI posts are paused for any of these series ("switched_off" first), or null when none is. */
export function pausedPlannerOf(series: readonly Pick<PostSeries, "planner">[]): PausedPlanner | null {
  const states = series.map(seriesPlanner);
  if (states.includes("switched_off")) return "switched_off";
  return states.includes("not_in_pilot") ? "not_in_pilot" : null;
}

/** The heading of the calm notice shown while the planner is paused (not an error). */
export const PLANNER_PAUSED_TITLE = "Automatic AI posts are paused";

/** Why automatic AI posts are paused, in one sentence. */
export function plannerPausedReason(planner: PausedPlanner): string {
  return planner === "not_in_pilot" ? "Automatic AI posts aren't switched on for your account yet." : "We're finishing quality checks on automatic AI posts.";
}

/**
 * The series card's notice under `PLANNER_PAUSED_TITLE`. `canWriteNow`: the viewer has the "Write the
 * next post now" button (they can edit and the series is active), which still works.
 */
export function plannerPausedText(planner: PausedPlanner, canWriteNow: boolean): string {
  const writeNow = `“${WRITE_NEXT_POST_LABEL}” still works.`;
  if (planner === "not_in_pilot") return `${plannerPausedReason(planner)} ${canWriteNow ? writeNow : "Your series is saved."}`;
  return `${plannerPausedReason(planner)} Your series is saved${canWriteNow ? `; ${writeNow}` : "."}`;
}

export type AutoPostsState = {
  /** Series the user hasn't paused. */
  active: PostSeries[];
  /** Active series whose posts the planner really writes. */
  writing: PostSeries[];
  /** Active series exist but the planner writes none of them: why. Otherwise null. */
  pausedBy: PausedPlanner | null;
  /** The soonest slot the planner will really write (an ISO instant), if any. Never a paused series' slot. */
  nextSlot: string | undefined;
};

/**
 * A location's auto-posts at a glance, for summaries: "Auto-posts are on · next AI post …", or
 * `PLANNER_PAUSED_TITLE` with `plannerPausedReason(pausedBy)` instead of a next post.
 */
export function autoPostsState(series: readonly PostSeries[]): AutoPostsState {
  const active = series.filter((entry) => entry.active);
  const writing = active.filter((entry) => seriesPlanner(entry) === "on");
  const pausedBy = active.length > 0 && writing.length === 0 ? pausedPlannerOf(active) : null;
  const nextSlot = writing
    .flatMap((entry) => entry.next_slots)
    .filter((slot) => Number.isFinite(Date.parse(slot)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  return { active, writing, pausedBy, nextSlot };
}

/** Why a slot wasn't written, for a series' recent results: short, past tense. */
const SKIPPED_BECAUSE: Record<string, string> = {
  insufficient_tokens: "Not enough tokens",
  ai_not_configured: "Automatic AI work was off",
  ai_budget_reached: "Automatic AI work was paused for the day",
  ai_org_budget_reached: "AI was paused for your organization that day",
  ai_failed: "Nothing usable came back; tokens refunded",
  gbp_not_connected: "The location wasn't connected to Google",
  v4_access_pending: "Google hadn't granted access to the profile's posts yet",
  organization_suspended: "The account was suspended",
  subscription_required: "The subscription needed attention",
  feature_not_included: "The plan doesn't include posts",
  no_topic: "AI found nothing new to write about",
  topic_not_available: "Its topic was taken meanwhile",
  series_changed: "The series changed while the post was written",
  interrupted: "It was interrupted; the post was kept as a draft",
  timed_out: "It couldn't start in time",
  ai_not_compliant: "The AI draft didn't meet Google's post rules; tokens refunded",
};

/** A history entry's `reason` in words. */
export function seriesErrorText(code: string): string {
  return SKIPPED_BECAUSE[code] ?? "A post couldn't be made";
}

/** A series history entry in words, with its tone (Phase 25c outcomes: held, expired, paused_* too). */
export function seriesHistoryWords(entry: Pick<PostSeriesHistoryEntry, "outcome" | "reason">): { text: string; tone: LabelTone | "success" } {
  switch (entry.outcome) {
    case "generated":
      return { text: entry.reason === "image_failed" ? "Written (text only: no picture could be made)" : "Written", tone: "success" };
    case "failed":
      return { text: `Not written: ${seriesErrorText(entry.reason ?? "")}`, tone: "critical" };
    case "held":
      return { text: `Waiting for review: ${entry.reason ? heldLabel(entry.reason).text : "a person checks it first"}`, tone: "warning" };
    default: {
      const label = seriesOutcomeLabel(entry.outcome);
      return label ? { text: label.text, tone: label.tone } : { text: "Something happened to this post", tone: "neutral" };
    }
  }
}

/**
 * True when a series needs a look, as the dashboard counts it (G10): it paused itself, or its last slot failed while
 * the planner is on.
 */
export function seriesNeedsAttention(series: Pick<PostSeries, "planner" | "last_error" | "paused">): boolean {
  return Boolean(series.paused) || seriesProblem(series) !== null;
}

const BACKGROUND_PAUSED = /automatic ai work is paused for today/i;
const BACKGROUND_OFF = /automatic ai work is off/i;

/**
 * True when a series' `last_error` only says AI couldn't run (switched off, or today's budget used up).
 * While the planner is paused that adds nothing (nothing runs on its own anyway, and the backend leaves
 * `last_error` as it was), so a card shows the planner notice alone instead of a second "paused" box.
 */
export function isAiAvailabilityProblem(error: { code: string; message?: string | null }): boolean {
  const message = error.message ?? "";
  return error.code === "ai_not_configured" || error.code === "ai_budget_reached" || BACKGROUND_PAUSED.test(message) || BACKGROUND_OFF.test(message);
}

/**
 * A series' `last_error` worth showing as "Needs attention", or null. 2026-11-17 (G10): only while the planner is
 * `on`; while it isn't, nothing tries the slot again and the error is stale (the history still lists it), so the card
 * agrees with the dashboard's count.
 */
export function seriesProblem(series: Pick<PostSeries, "planner" | "last_error">): PostSeries["last_error"] {
  const error = series.last_error;
  return error && seriesPlanner(series) === "on" ? error : null;
}

export type SeriesProblemCopy = { title: string; detail?: string };

/**
 * A series' `last_error` in words, for the card's problem box (present tense). The backend's own
 * `message` is never shown: the planner's background budget messages ("Automatic AI work is paused for
 * today (daily budget reached). It resumes tomorrow.", "Automatic AI work is off on this server.") are
 * mapped to plain words by code or by text, so people never read "server".
 *
 * The background budget is counted per UTC day, like the users' one: "paused for today" says when it's
 * back in the viewer's time ("It resumes at 7:00 PM."), and an error from an earlier UTC day says the
 * pause is over. `now` is passed in (never read during render).
 */
export function seriesProblemCopy(error: { code: string; message?: string | null; at?: string | null }, now: number): SeriesProblemCopy {
  const message = error.message ?? "";
  if (error.code === "ai_budget_reached" || BACKGROUND_PAUSED.test(message)) {
    const at = error.at ? Date.parse(error.at) : Number.NaN;
    if (!Number.isFinite(at)) return { title: "Automatic AI work is paused for today", detail: "It resumes tomorrow." };
    const back = nextUtcMidnight(at);
    if (back <= now) return { title: "Automatic AI work was paused for the day" };
    return { title: "Automatic AI work is paused for today", detail: `It resumes at ${formatResumeTime(back, now)}.` };
  }
  if (error.code === "ai_not_configured" || BACKGROUND_OFF.test(message)) return { title: PLANNER_PAUSED_TITLE };
  switch (error.code) {
    case "insufficient_tokens":
      return { title: "Not enough tokens" };
    case "ai_org_budget_reached":
      return { title: "AI is paused for your organization today", detail: "It resumes tomorrow." };
    case "ai_failed":
      return { title: "Nothing usable came back", detail: "Your tokens were refunded." };
    case "ai_not_compliant":
      return { title: "The AI draft didn't meet Google's post rules", detail: "Your tokens were refunded." };
    case "gbp_not_connected":
      return { title: "The location isn't connected to Google" };
    case "v4_access_pending":
      return { title: "Google hasn't granted access to this profile's posts yet" };
    case "organization_suspended":
      return { title: "The account is suspended", detail: "Nothing was spent." };
    case "subscription_required":
      return { title: "The subscription needs attention", detail: "Nothing was spent." };
    case "feature_not_included":
      return { title: "Your plan doesn't include posts", detail: "Nothing was spent." };
    case "no_topic":
      return { title: "AI found nothing new to write about", detail: "Add facts about the business in AI Settings, or give the series its own topics." };
    case "topic_not_available":
      return { title: "Its topic was taken meanwhile" };
    case "series_changed":
      return { title: "The series changed while its post was written", detail: "Nothing was spent." };
    case "interrupted":
      return { title: "Writing the post was interrupted", detail: "The post was kept as a draft for you to check." };
    default:
      return { title: "A post couldn't be made" };
  }
}
