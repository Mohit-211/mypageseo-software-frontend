/**
 * Words for a failed AI settings or facts change (Phase 25a; backend docs, API.md "AI per location").
 * No AI and no tokens are involved, so none of the AI error deck applies here.
 * - Settings: 403 `owner_only` (restricted mode off), 400 `attestation_required`, 400 `invalid_input`.
 * - Facts: 400 `invalid_fact` (`issues: [{ field, code, message }]`, shown next to each field),
 *   `offer_not_allowed_for_lodging`, `offer_not_allowed_for_regulated` (`sector`, and `term` when the
 *   offer's own words name a regulated product), `too_many_facts` (`limit`), 404 `fact_not_found`.
 * - Both: 403 `read_only` (a client user).
 */
import { apiErrorData, isApiError, type AiFactIssue } from "@/api";
import type { FactField } from "./fact-form";

/** A client user's answer to any change here, and the note on the read-only page. */
export const READ_ONLY_TEXT = "Your agency manages these settings.";

const RESTRICTED_OWNER_ONLY = "Only the account owner can switch restricted mode off.";

/** A failed `PUT ai/settings`. */
export function settingsErrorText(err: unknown, fallback = "Your changes couldn't be saved. Try again."): string {
  if (!isApiError(err)) return fallback;
  switch (err.reason) {
    case "owner_only":
      return RESTRICTED_OWNER_ONLY;
    case "attestation_required":
      return "Tick the box to confirm, then switch restricted mode off.";
    case "read_only":
      return READ_ONLY_TEXT;
    case "invalid_input":
      return "Some of these values can't be saved. Check them and try again.";
    default:
      if (err.status === 404) return "This location was removed, so its AI settings are gone.";
      return fallback;
  }
}

/** The field problems of a 400 `invalid_fact` (empty for any other error). */
export function factIssuesFromError(err: unknown): AiFactIssue[] {
  if (!isApiError(err) || err.reason !== "invalid_fact") return [];
  const issues = apiErrorData(err).issues;
  return Array.isArray(issues) ? issues.filter((issue): issue is AiFactIssue => Boolean(issue) && typeof issue === "object" && typeof issue.field === "string") : [];
}

const ISSUE_COPY: Partial<Record<string, string>> = {
  text_required: "Write the fact.",
  title_required: "Add a title.",
  start_required: "Add the start date.",
  end_required: "Add the end date.",
  invalid_date: "Pick a valid date and time.",
  end_before_start: "The end must be after the start.",
  already_ended: "This date has passed. Pick a later end.",
  invalid_url: "Use an https:// address.",
  terms_url_required: "A contest needs a link to its rules (https://…).",
};

const FORM_FIELDS: readonly string[] = ["text", "topic", "title", "start", "end", "coupon_code", "redeem_url", "terms", "terms_url"];

/**
 * The backend's field problems, by field (its own words for the rest: lengths, a field the kind
 * doesn't have). Problems on another field (`kind`) come back under `other`.
 */
export function factIssuesByField(issues: readonly AiFactIssue[]): { fields: Partial<Record<FactField, string>>; other: string[] } {
  const fields: Partial<Record<FactField, string>> = {};
  const other: string[] = [];
  for (const issue of issues) {
    const text = ISSUE_COPY[issue.code] ?? issue.message;
    if (FORM_FIELDS.includes(issue.field)) {
      const field = issue.field as FactField;
      fields[field] ??= text;
    } else {
      other.push(text);
    }
  }
  return { fields, other };
}

/** A failed fact change (add, edit, switch, delete), in plain words. */
export function factErrorText(err: unknown, fallback = "This couldn't be saved. Try again."): string {
  if (!isApiError(err)) return fallback;
  const data = apiErrorData(err);
  const sector = typeof data.sector === "string" && data.sector ? data.sector : null;
  const term = typeof data.term === "string" && data.term ? data.term : null;
  switch (err.reason) {
    case "invalid_fact":
      return "Fix the highlighted fields, then save again.";
    case "offer_not_allowed_for_regulated":
      return term
        ? `Offers can't name ${term}${sector ? ` (${sector})` : ""}. Offer something else, or add it as an event or a fact.`
        : `Google restricts offers for ${sector ?? "regulated products"}. Add an event or a fact instead.`;
    case "offer_not_allowed_for_lodging":
      return "Google doesn't allow offers for hotels and other lodging. Add an event or a fact instead.";
    case "too_many_facts": {
      const limit = typeof data.limit === "number" ? data.limit : 100;
      return `You can keep up to ${limit}. Delete one to add another.`;
    }
    case "fact_not_found":
      return "This was deleted in the meantime.";
    case "read_only":
      return READ_ONLY_TEXT;
    case "invalid_input":
      return "Some of these fields can't be saved. Check them and try again.";
    default:
      if (err.status === 404) return "This location was removed, so its facts are gone.";
      return fallback;
  }
}

/** True when the list is out of date (the fact was deleted elsewhere): read it again. */
export function isFactGone(err: unknown): boolean {
  return isApiError(err) && err.reason === "fact_not_found";
}

/**
 * A 404 without a reason on a read: the location page itself loaded, so these routes aren't there
 * yet (Phase 25a goes live with a backend deploy).
 */
export function isNotAvailableYet(err: unknown): boolean {
  return isApiError(err) && err.status === 404 && !err.reason;
}
