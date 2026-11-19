/**
 * Automatic replies on reviews (Phase 25b, 2026-11-16 "Automatic replies" item 5), as words:
 * - on a review: `sent_via: "auto"` ("Sent automatically") and `auto { state, reasons, labels, scheduled_for }`:
 *   `queued` / `drafting` (being written), `scheduled` ("Goes out at …"), `sending`, `sent`, `held` (waits for a
 *   person, with the fixed words of its reasons in `labels`) and `cancelled` (a person took over, or the review
 *   changed). These are facts about the review, shown whatever the switch says now;
 * - the location's line, from `GET …/reviews/summary` → `auto_reply { enabled, sent_7d, held_7d, paused }`
 *   ("Automatic replies: on · 3 sent this week · 1 held"), shown only while the server's switch
 *   (`GET …/reviews/auto-reply` → `feature`) is `on`. Its settings card is on AI Settings (`#auto-replies`).
 */
import { useQuery } from "@tanstack/react-query";
import type { AiFeatureState, AutoReplyPauseReason, Review, ReviewsSummary } from "@/api";
import type { StatusTone } from "@/components/layout/shared/module-tone";
import { formatShortDate, formatTime } from "@/lib/datetime";
import { autoReplyFeatureQuery } from "./use-reviews";

export type AutoReplyNote = {
  state: NonNullable<Review["auto"]>["state"];
  /** One line: "Goes out automatically today at 3:45 PM". */
  title: string;
  /** What it means for the user, or null. */
  detail: string | null;
  /** `held` / `cancelled`: the fixed words of its reasons. */
  labels: string[];
  tone: StatusTone;
  /** `scheduled`: when it goes out (ISO). */
  at: string | null;
};

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "today at 3:45 PM", "tomorrow at 9:10 AM", "on Nov 21 at 9:10 AM" (`now` from `useNow()`, never read during render). */
export function whenText(iso: string | null | undefined, now: number | undefined): string {
  if (!iso) return "soon";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "soon";
  const time = formatTime(iso, "");
  if (now === undefined) return `on ${formatShortDate(iso, "")} at ${time}`;
  const today = new Date(now);
  if (sameDay(at, today)) return `today at ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(at, tomorrow)) return `tomorrow at ${time}`;
  return `on ${formatShortDate(iso, "")} at ${time}`;
}

/**
 * Where the review's automatic reply stands, or null when it isn't handled automatically (or it went out: the reply
 * itself says "Sent automatically"). `canEdit`: the words for someone who can take over (not a client user).
 */
export function autoReplyNote(review: Pick<Review, "auto" | "draft">, options: { now?: number; canEdit?: boolean } = {}): AutoReplyNote | null {
  const auto = review.auto;
  if (!auto) return null;
  const canEdit = options.canEdit ?? true;
  const labels = (auto.labels ?? []).map((label) => label.trim()).filter(Boolean);
  const base = { state: auto.state, labels, at: null };
  switch (auto.state) {
    case "queued":
    case "drafting":
      return { ...base, title: "Automatic reply being written", detail: null, tone: "ai" };
    case "scheduled":
      return {
        ...base,
        at: auto.scheduled_for ?? null,
        title: `Goes out automatically ${whenText(auto.scheduled_for, options.now)}`,
        detail: canEdit ? "Change or delete the draft, or send a reply yourself, and it won't go out." : null,
        tone: "info",
      };
    case "sending":
      return { ...base, title: "Automatic reply being sent", detail: null, tone: "info" };
    case "held":
      return {
        ...base,
        title: "Held for a person",
        detail: canEdit
          ? review.draft?.text
            ? "Automatic replies skip reviews like this one. Check the draft and send it yourself."
            : "Automatic replies skip reviews like this one. Write the reply yourself, or draft it with AI."
          : "Automatic replies skip reviews like this one, so a person answers it.",
        tone: "warning",
      };
    case "cancelled":
      return { ...base, title: "Automatic reply cancelled", detail: null, tone: "neutral" };
    default:
      // `sent`: the reply on Google says "Sent automatically".
      return null;
  }
}

/** Why automatic replies are paused, in words (`paused.reason`). */
export const AUTO_REPLY_PAUSE_TEXT: Record<AutoReplyPauseReason, string> = {
  user: "paused",
  google_rejected: "paused: Google rejected an automatic reply",
  account_restricted: "paused: Google restricted the Google account",
  admin: "paused by MyPageSEO",
};

export type AutoReplyLine = {
  state: "on" | "off" | "paused";
  /** "Automatic replies: on · 3 sent this week · 1 held". */
  text: string;
  tone: StatusTone;
};

/** The location's automatic replies in one line (`summary.auto_reply`), or null when the summary doesn't say. */
export function autoReplyLine(autoReply: ReviewsSummary["auto_reply"]): AutoReplyLine | null {
  if (!autoReply) return null;
  const counts = [
    autoReply.sent_7d > 0 ? `${autoReply.sent_7d.toLocaleString()} sent this week` : null,
    // "held for a person": the reviews automatic replies left to a person (a client user reads it too).
    autoReply.held_7d > 0 ? `${autoReply.held_7d.toLocaleString()} held for a person` : null,
  ].filter((part): part is string => part !== null);
  if (autoReply.paused) {
    return {
      state: "paused",
      text: [`Automatic replies: ${AUTO_REPLY_PAUSE_TEXT[autoReply.paused.reason] ?? "paused"}`, ...counts].join(" · "),
      tone: autoReply.paused.reason === "user" ? "neutral" : "warning",
    };
  }
  if (!autoReply.enabled) return { state: "off", text: "Automatic replies: off", tone: "neutral" };
  return { state: "on", text: ["Automatic replies: on", ...(counts.length ? counts : ["nothing sent this week"])].join(" · "), tone: "success" };
}

const selectFeature = (settings: { feature: AiFeatureState }) => settings.feature;

/** The server's switch for automatic replies at this location (`on`, `switched_off`, `not_in_pilot`), or undefined while unknown. */
export function useAutoReplyFeature(locationId: string, enabled = true): AiFeatureState | undefined {
  return useQuery({ ...autoReplyFeatureQuery(locationId), select: selectFeature, enabled }).data;
}
