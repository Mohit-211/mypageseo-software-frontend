/**
 * The location's logo (Phase 25c, `GET/PUT/DELETE /locations/:locationId/logo`), pure: the AI Settings section
 * `#logo`. Code places it on post pictures (never the AI); it is private, shown from its `data_url`.
 *
 * - Set it from an upload (`data`: a PNG, JPEG or WebP of at most 512 KB, sent as a data URL) or from the website
 *   (`candidate_url`: one of `candidates`), always with `attest: true` ("This is my business's own logo").
 * - "Use for all my locations" (`apply_to: "organization"`) only when `can_apply_to_organization`.
 * - An AI check reads it (free, about a minute at most): 422 `logo_rejected` with `issues` says what to remove; the
 *   400s say what is wrong with the file; 503/502 mean the check couldn't run and nothing was saved. A paused AI
 *   (`ai_budget_reached`, `ai_org_budget_reached`) is said as every AI call says it, and `use-logo.ts` notes it
 *   (`noteAiError`) so the AI status everywhere shows it paused.
 */
import { apiErrorData, isApiError, type LocationLogo, type LogoCandidate, type LogoIssue } from "@/api";
import { aiErrorText } from "@/lib/ai/ai-errors";
import { formatResumeTime, nextUtcMidnight } from "@/lib/ai/ai-time";
import { formatDate } from "@/lib/datetime";
import { READ_ONLY_TEXT } from "./errors";
import { byActor, isViewer } from "./names";

export const LOGO_MAX_BYTES = 512 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
/** For the file picker. */
export const LOGO_ACCEPT = LOGO_TYPES.join(",");

/** Why a picked file can't be sent (checked before uploading), or null. */
export function logoFileProblem(file: Pick<File, "type" | "size">): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return "Pick a PNG, JPEG or WebP image.";
  if (file.size > LOGO_MAX_BYTES) return "This file is over 512 KB. Save a smaller version and pick it again.";
  if (file.size === 0) return "This file is empty.";
  return null;
}

/** The file as a data URL ("data:image/png;base64,…"), as `PUT …/logo` takes it. */
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The file couldn't be read.")));
    reader.onerror = () => reject(reader.error ?? new Error("The file couldn't be read."));
    reader.readAsDataURL(file);
  });
}

/** What to remove from a refused logo, per issue. */
const ISSUE_COPY: Record<LogoIssue, string> = {
  phone_number: "the phone number",
  web_address: "the web address",
  email: "the email address",
  social_handle: "the social media handle",
  qr_code: "the QR code or barcode",
  badge: "the badge, seal, award or rating stars",
  too_many_words: "some of the words (6 at most)",
  unsafe: "",
};

const listText = (parts: string[]) => (parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);

/** 422 `logo_rejected`: "Remove the phone number and the web address, then upload it again." */
export function logoIssuesText(issues: readonly string[]): string {
  if (issues.includes("unsafe")) return "This image can't be used as a logo. Upload another one.";
  const parts = issues.map((issue) => ISSUE_COPY[issue as LogoIssue]).filter((part): part is string => Boolean(part));
  if (parts.length === 0) return "This logo can't go on post pictures as it is. Upload a simpler version.";
  return `A logo on post pictures can't carry contact details, badges or many words. Remove ${listText(parts)}, then upload it again.`;
}

/** A failed `PUT` or `DELETE …/logo`, in plain words. */
export function logoErrorText(err: unknown): string {
  if (!isApiError(err)) return "Your logo couldn't be saved. Try again.";
  const data = apiErrorData(err);
  switch (err.reason) {
    case "logo_rejected":
      return logoIssuesText(Array.isArray(data.issues) ? data.issues.filter((x): x is string => typeof x === "string") : []);
    case "attestation_required":
      return "Tick the box to confirm this is your business's own logo.";
    case "logo_too_large":
      return "This file is over 512 KB. Save a smaller version and try again.";
    case "logo_type":
      return "Upload a PNG, JPEG or WebP image.";
    case "logo_unreadable":
      return "This image couldn't be read. Try another file.";
    case "logo_blank":
      return "This image is empty. Pick the file with your logo.";
    case "logo_too_small":
      return "This logo is too small: it needs at least 64 pixels once its empty edges are trimmed. Upload a larger version.";
    case "logo_too_wide":
      return "This logo is too wide to fit a corner of a post picture at a size people can read. Upload a stacked or square version.";
    case "logo_too_tall":
      return "This logo is too tall to fit a corner of a post picture. Upload a horizontal or square version.";
    case "logo_candidate_unknown":
      return "That logo isn't on the list from your website any more. Pick one again.";
    case "logo_fetch_failed":
      return "That logo couldn't be read from your website. Save it to your computer and upload it instead.";
    case "owner_only":
      return "Only the account owner can use one logo for every location.";
    case "business_only":
      return "Each client's logo is set at that client's location.";
    case "read_only":
      return READ_ONLY_TEXT;
    case "subscription_required":
      return "Changing the logo needs an active subscription.";
    case "organization_suspended":
      return "This account is suspended. Contact support.";
    case "feature_not_included":
      return "Your plan doesn't include posts, so the logo for post pictures isn't available.";
    case "ai_budget_reached":
    case "ai_org_budget_reached": {
      // Paused as every AI call says it ("AI is paused for today", "… for your organization today"), until 00:00 UTC.
      const now = Date.now();
      return `${aiErrorText(err, { now }).title}, so your logo couldn't be checked. Nothing was saved: try again at ${formatResumeTime(nextUtcMidnight(now), now)}.`;
    }
    case "ai_not_configured":
      return "The logo check isn't switched on yet. Nothing was saved: try again later.";
    case "ai_failed":
      return "The logo check couldn't finish. Nothing was saved: try again.";
    case "invalid_input":
      return "This logo couldn't be sent. Pick the file again.";
    default:
      if (err.status === 413) return "This file is too large. Save a version under 512 KB and try again.";
      if (err.status === 404) return "This location was removed.";
      if (err.status >= 500) return "Nothing was saved: the logo check couldn't run. Try again.";
      return "Your logo couldn't be saved. Try again.";
  }
}

/**
 * "Confirmed as the business's own logo by Ana Diaz on Nov 13, 2026." (null before anyone confirmed it). The owner or
 * a member confirms it, so without a name to show the line has no "by" ("by your agency" for a client user): the
 * names rule of `names.ts`.
 */
export function logoConfirmedText(
  logo: Pick<LocationLogo, "attested_by" | "attested_by_name" | "attested_at">,
  viewer: { userId: string | null; clientUser: boolean },
): string | null {
  if (!logo.attested_at) return null;
  const by = byActor({ name: logo.attested_by_name, mine: isViewer(logo.attested_by, viewer.userId), role: "team" }, viewer);
  return `Confirmed as the business's own logo${by} on ${formatDate(logo.attested_at)}.`;
}

/** True for the errors after which the website's list should be read again. */
export function isStaleCandidateError(err: unknown): boolean {
  return isApiError(err) && err.reason === "logo_candidate_unknown";
}

/** Where a website logo was found, in a few words. */
export function candidateSourceText(candidate: LogoCandidate): string {
  switch (candidate.source) {
    case "jsonld":
      return "Named as the logo on your website";
    case "img":
      return "An image on your website";
    case "apple_touch_icon":
      return "Your website's app icon";
    case "icon":
      return "Your website's icon";
    case "og_image":
      return "Your website's sharing image";
    default:
      return "Found on your website";
  }
}

/** "bytownpipe.example/img/logo.png" for a candidate's address (no scheme, no query). */
export function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

/** "21 KB" for a byte count. */
export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
