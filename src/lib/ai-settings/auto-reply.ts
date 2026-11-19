/**
 * Automatic replies to 4–5★ reviews (Phase 25b, `GET/PUT …/reviews/auto-reply`), pure: the card on AI Settings
 * (`#auto-replies`). Shown only while the server's `feature` is `on`.
 *
 * - **Scope:** on/off, ratings `[5]` or `[4, 5]`, stars-only reviews, a daily cap (1–`daily_cap_max`, 5 by default).
 * - **Consent (Google's API policy):** switching on or widening (4★ added, stars only on, a higher cap; the backend's
 *   `widens`) needs the caller's `consent_method` (`owner`: a Business owner; `client`: a client user of the
 *   location's client; `owner_attestation`: the agency owner) and sends `consent_version` after showing
 *   `consent_text`. A member's `consent_method` is null: "Ask the account owner (or your client)". An agency also
 *   needs the client's reply authorization first (`reply_authorization_required`).
 * - **No consent needed:** switching off, narrowing and pausing; owners and members may, and so may a client user
 *   of the location's client (`consent_method: "client"`), who sees the off switch. Switching off ends the consent.
 * - **Pauses:** `paused { reason, at, detail, resume }`; `resume` says who may lift it: `write` (whoever may switch
 *   off), `consent` (whoever may switch on) or `admin` (only MyPageSEO: "Paused by MyPageSEO").
 */
import { apiErrorData, isApiError, type AutoReplyConsentMethod, type AutoReplyPause, type AutoReplySettings, type AutoReplyUpdate } from "@/api";
import type { Role } from "@/lib/mypageseo/access";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { READ_ONLY_TEXT } from "./errors";
import { byActor, grantRole, isViewer } from "./names";

export type AutoReplyRatings = [5] | [4, 5];

/** What automatic replies cover. */
export type AutoReplyScope = { enabled: boolean; ratings: AutoReplyRatings; stars_only: boolean; daily_cap: number };

export const AUTO_REPLY_CAP_DEFAULT = 5;
export const AUTO_REPLY_CAP_MAX = 20;

const ratingsOf = (ratings: readonly number[] | null | undefined): AutoReplyRatings => (ratings?.includes(4) ? [4, 5] : [5]);

/** True when 4★ reviews are covered too. */
export const withFourStars = (ratings: AutoReplyRatings): boolean => ratings.length === 2;

/** The scope in force (as agreed: `enabled` only while a consent holds). */
export function scopeOf(view: AutoReplySettings): AutoReplyScope {
  const cap = Number.isInteger(view.daily_cap) && view.daily_cap >= 1 ? view.daily_cap : AUTO_REPLY_CAP_DEFAULT;
  return { enabled: Boolean(view.enabled), ratings: ratingsOf(view.ratings), stars_only: Boolean(view.stars_only), daily_cap: cap };
}

export const capMaxOf = (view: AutoReplySettings): number =>
  Number.isInteger(view.daily_cap_max) && view.daily_cap_max >= 1 ? view.daily_cap_max : AUTO_REPLY_CAP_MAX;

/** The backend's `widens`: switched on, 4★ added, stars only on, or a higher cap. Only these need a consent. */
export function widens(current: AutoReplyScope, next: AutoReplyScope): boolean {
  if (!next.enabled) return false;
  if (!current.enabled) return true;
  return (withFourStars(next.ratings) && !withFourStars(current.ratings)) || (next.stars_only && !current.stars_only) || next.daily_cap > current.daily_cap;
}

const sameRatings = (a: AutoReplyRatings, b: AutoReplyRatings) => a.length === b.length;

/** True when `next` differs from what is in force. */
export function scopeChanged(current: AutoReplyScope, next: AutoReplyScope): boolean {
  return current.enabled !== next.enabled || !sameRatings(current.ratings, next.ratings) || current.stars_only !== next.stars_only || current.daily_cap !== next.daily_cap;
}

/** The `PUT` body for `next`: the fields that change (absent = kept), and `consent_version` when it widens. */
export function scopeUpdate(current: AutoReplyScope, next: AutoReplyScope, consentVersion: string | null): AutoReplyUpdate {
  // Switching off sends only that: what it covered stays as it was for the next time.
  if (!next.enabled) return { enabled: false };
  const body: { enabled?: boolean; ratings?: AutoReplyRatings; stars_only?: boolean; daily_cap?: number; consent_version?: string } = {};
  if (!current.enabled) body.enabled = true;
  if (!current.enabled || !sameRatings(current.ratings, next.ratings)) body.ratings = next.ratings;
  if (!current.enabled || current.stars_only !== next.stars_only) body.stars_only = next.stars_only;
  if (!current.enabled || current.daily_cap !== next.daily_cap) body.daily_cap = next.daily_cap;
  if (widens(current, next) && consentVersion) body.consent_version = consentVersion;
  return body;
}

/** What a widening adds, in words, for the consent dialog ("4★ reviews", "reviews with stars and no text", …). */
export function wideningParts(current: AutoReplyScope, next: AutoReplyScope): string[] {
  if (!current.enabled) return [];
  const parts: string[] = [];
  if (withFourStars(next.ratings) && !withFourStars(current.ratings)) parts.push("positive 4★ reviews");
  if (next.stars_only && !current.stars_only) parts.push("reviews with stars and no text");
  if (next.daily_cap > current.daily_cap) parts.push(`up to ${next.daily_cap} a day`);
  return parts;
}

/** "New 5★ reviews", "New 4★ and 5★ reviews, stars-only ones too, up to 5 a day". */
export function scopeText(scope: AutoReplyScope): string {
  const ratings = withFourStars(scope.ratings) ? "New 4★ and 5★ reviews" : "New 5★ reviews";
  const stars = scope.stars_only ? ", stars-only ones too" : ", with text";
  return `${ratings}${stars}, up to ${scope.daily_cap} a day`;
}

/**
 * Who may change anything here at all (narrow, switch off, pause): an owner or a member, or a client user of the
 * location's client (`consent_method: "client"`). Anyone else reads.
 */
export function canChangeAutoReply(view: AutoReplySettings, role: Role): boolean {
  return role === "owner" || role === "member" || view.consent_method === "client";
}

/** Who may switch on or widen (and resume after Google): the caller has a consent method. */
export function canConsentAutoReply(view: AutoReplySettings): boolean {
  return view.consent_method !== null && Boolean(view.consent_text);
}

/** Why the caller can't switch on or widen: who can. */
export function whoCanConsentText(isAgency: boolean): string {
  return isAgency
    ? "Only your client or the account owner can switch on automatic replies or let them answer more reviews. Ask one of them."
    : "Only the account owner can switch on automatic replies or let them answer more reviews. Ask them.";
}

/** The consent dialog's words for the caller's method. */
export function consentDialogCopy(method: AutoReplyConsentMethod, widening: boolean): { title: string; checkbox: string; confirm: string } {
  switch (method) {
    case "client":
      return {
        title: widening ? "Let your agency answer more reviews automatically?" : "Let your agency reply automatically?",
        checkbox: "I agree",
        confirm: widening ? "I agree, save" : "I agree, switch on",
      };
    case "owner_attestation":
      return {
        title: widening ? "Confirm your client agreed to more" : "Confirm your client agreed",
        checkbox: "I confirm",
        confirm: widening ? "Confirm and save" : "Confirm and switch on",
      };
    default:
      return {
        title: widening ? "Answer more reviews automatically?" : "Switch on automatic replies?",
        checkbox: "I agree",
        confirm: widening ? "I agree, save" : "I agree, switch on",
      };
  }
}

/**
 * Who agreed to the automatic replies in force, and when (null without a consent), by the names rule of `names.ts`:
 * - `owner_attestation`: "Switched on by Alex Morgan on Nov 15, 2026, confirming the client agreed." ("by the account
 *   owner" without a name, "by your agency" for a client user);
 * - `client`: "Agreed by Morgan Patel for the client on Nov 15, 2026." ("Agreed by you on …" to that client user, and
 *   no "for the client" to any client user: they are the client); without a name it's the client's: "Agreed by
 *   Harbor Dental on …" ("by someone at Harbor Dental" for a client user);
 * - `owner` (a Business owner): "Agreed by Jordan Lee on …" ("by the account owner" without a name).
 * `client`: the location's client.
 */
export function autoReplyAgreedText(
  consent: AutoReplySettings["consent"],
  viewer: { userId: string | null; clientUser: boolean },
  client?: string | null,
): string | null {
  if (!consent) return null;
  const mine = isViewer(consent.user_id, viewer.userId);
  const by = byActor({ name: consent.user_name, mine, role: grantRole(consent.method), client }, viewer);
  const when = formatDate(consent.at);
  if (consent.method === "owner_attestation") return `Switched on${by} on ${when}, confirming the client agreed.`;
  // "For the client" tells the agency whom a named person agreed for; the client's own name (no person to show) says
  // it already, "you" is that client's user, and a client user is the client.
  const forClient = consent.method === "client" && !mine && !viewer.clientUser && Boolean(consent.user_name?.trim()) ? " for the client" : "";
  return `Agreed${by}${forClient} on ${when}.`;
}

export type PauseCopy = { title: string; detail: string | null; tone: "warning" | "info" | "critical" };

/** The pause banner: why, since when, and Google's or MyPageSEO's note. */
export function pauseCopy(pause: AutoReplyPause): PauseCopy {
  const at = formatDateTime(pause.at, "");
  const since = at ? ` on ${at}` : "";
  const note = pause.detail?.trim() || null;
  switch (pause.reason) {
    case "user":
      return { title: `Paused by your team${since}`, detail: "New reviews wait for a person until you resume.", tone: "info" };
    case "google_rejected":
      return {
        title: `Paused: Google rejected an automatic reply${since}`,
        detail: note ? `Google's reason: ${note}` : "New reviews wait for a person until automatic replies are resumed.",
        tone: "warning",
      };
    case "account_restricted":
      return {
        title: `Paused: Google restricted the Google account${since}`,
        detail: "Every location on that Google account is paused. New reviews wait for a person until automatic replies are resumed.",
        tone: "warning",
      };
    case "admin":
      return { title: `Paused by MyPageSEO${since}`, detail: note ?? "Contact support to find out more.", tone: "critical" };
  }
}

/** Whether the caller may lift the pause (`admin`: nobody in the app). */
export function canResume(view: AutoReplySettings, role: Role): boolean {
  const pause = view.paused;
  if (!pause) return false;
  if (pause.resume === "admin") return false;
  if (pause.resume === "consent") return canConsentAutoReply(view);
  return canChangeAutoReply(view, role);
}

export type AutoReplyErrorAction = "reload" | "authorization" | "billing" | "support" | "connect";

/** A failed change in plain words, and what the card should do about it. */
export function autoReplyErrorText(err: unknown, isAgency: boolean): { text: string; action: AutoReplyErrorAction | null } {
  if (!isApiError(err)) return { text: "Automatic replies couldn't be changed. Try again.", action: null };
  switch (err.reason) {
    case "consent_required":
      return { text: "Read the text and tick the box to agree first.", action: null };
    case "consent_outdated":
      return { text: "The consent text changed. Read the new text and agree again.", action: "reload" };
    case "gbp_not_connected":
      return { text: "Connect this location to its Google Business Profile first.", action: "connect" };
    case "auto_reply_off":
      return { text: "Automatic replies are off for this location now.", action: "reload" };
    case "subscription_required":
      return { text: "Switching on automatic replies needs an active subscription.", action: "billing" };
    case "auto_reply_not_available":
      return { text: "Automatic replies aren't available for this account yet.", action: "reload" };
    case "owner_only":
      return { text: whoCanConsentText(false), action: null };
    case "client_or_owner_only":
      return { text: whoCanConsentText(true), action: null };
    case "admin_paused":
      return { text: "MyPageSEO paused automatic replies for this location. Contact support to resume them.", action: "support" };
    case "read_only":
      return { text: READ_ONLY_TEXT, action: null };
    case "organization_suspended":
      return { text: "This account is suspended. Contact support.", action: "support" };
    case "reply_authorization_required":
      return { text: isAgency ? "Your client's authorization to reply comes first." : "The authorization to reply comes first.", action: "authorization" };
    case "auto_reply_changed":
      return { text: "Automatic replies changed in the meantime. They're reloaded: check them and try again.", action: "reload" };
    case "invalid_input":
      return { text: "These settings can't be saved. Check them and try again.", action: null };
    default:
      if (err.status === 404) return { text: "This location was removed.", action: null };
      if (err.status >= 500) return { text: "Automatic replies couldn't be changed right now. Try again in a minute.", action: null };
      return { text: "Automatic replies couldn't be changed. Try again.", action: null };
  }
}

/** The consent version a 400 `consent_required` / `consent_outdated` carries (the current one), if any. */
export function consentVersionFromError(err: unknown): string | null {
  const version = apiErrorData(err).consent_version;
  return typeof version === "string" && version ? version : null;
}

/** "4 sent automatically · 1 waiting for a person · 1 going out soon" for the week. */
export function weekText(view: AutoReplySettings): string {
  const parts = [`${view.sent_7d ?? 0} sent automatically`, `${view.held_7d ?? 0} waiting for a person`];
  if (view.scheduled) parts.push(`${view.scheduled} going out soon`);
  return parts.join(" · ");
}
