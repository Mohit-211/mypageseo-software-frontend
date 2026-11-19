/**
 * The photo library (Phase 25c, `…/posts/media?library=true`), pure: the business's own photos that AI posts use
 * first (a fitting library photo, then that photo enhanced, then an AI image). At most 200 per location.
 *
 * - Upload with the form field `library: true`: JPEG or PNG, at most 5 MB and 50 megapixels, at least 250×250
 *   (409 `library_full`, `library_duplicate`; 400 `media_too_large`, …). Other photos (uploads made in the post
 *   editor) can join later (`PATCH { library: true }`); AI images and post pictures can't (`library_uploads_only`).
 * - A job captions and screens each photo: `screening.state` `pending` → `ok`, `flagged` (with `flags`) or `failed`.
 *   A flagged photo is never picked for automatic posts (`people` only keeps it out of auto-publishing series);
 *   "Use anyway" clears `stock_like` or `watermark` (`flags_cleared`). `quality.verdict` `poor` is never picked
 *   automatically; `enhance` gets a gentle touch-up when used.
 * - The caption (1–200, `null` = back to the screening's) decides which posts a photo fits.
 */
import { apiErrorData, isApiError, type AiReadiness, type ClearablePhotoFlag, type PhotoScreeningFlag, type PostMediaDetails, type PostMediaList } from "@/api";
import { formatShortDate } from "@/lib/datetime";

export const LIBRARY_MAX = 200;

/** A client user's answer to any change here (403 `read_only`), and the note on the read-only page. */
export const LIBRARY_READ_ONLY_TEXT = "Your agency manages these photos.";

/** The library's size and cap from a `GET …/posts/media` page (`library { count, max }`); null before 25c answers. */
export function librarySize(page: Pick<PostMediaList, "library"> | null | undefined): { count: number; max: number } | null {
  const library = page?.library;
  if (!library || typeof library.count !== "number") return null;
  return { count: Math.max(0, library.count), max: typeof library.max === "number" && library.max > 0 ? library.max : LIBRARY_MAX };
}

const COUNT = new Intl.NumberFormat("en-US");

/**
 * "6 of 200 photos · 3 ready to use · 1 being checked · 1 kept out": the library's size, and where its photos stand
 * for automatic posts (the readiness checklist's counts: `usable` = screened ok and not poor).
 */
export function libraryCountsText(size: { count: number; max: number } | null, photos: AiReadiness["details"]["photos"] | null | undefined): string | null {
  const parts: string[] = [];
  if (size) parts.push(`${COUNT.format(size.count)} of ${COUNT.format(size.max)} photos`);
  if (photos) {
    parts.push(`${COUNT.format(photos.usable)} ready to use`);
    if (photos.pending > 0) parts.push(`${COUNT.format(photos.pending)} being checked`);
    if (photos.flagged > 0) parts.push(`${COUNT.format(photos.flagged)} kept out`);
  }
  return parts.length ? parts.join(" · ") : null;
}
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png"] as const;
export const PHOTO_ACCEPT = PHOTO_TYPES.join(",");
export const CAPTION_MAX = 200;
/** Photos per page of the grid ("Show more"). */
export const LIBRARY_PAGE_SIZE = 48;

/** Why a picked file can't be uploaded (checked before sending), as the rest of a sentence about it; null when it can. */
export function photoFileProblem(file: Pick<File, "type" | "size">): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return "isn't a JPEG or PNG photo.";
  if (file.size > PHOTO_MAX_BYTES) return "is over 5 MB: photos can be up to 5 MB.";
  if (file.size === 0) return "is empty.";
  return null;
}

/* -------------------------------------------------------------------------- */
/* Screening and quality                                                       */
/* -------------------------------------------------------------------------- */

/** A screening flag as a short tag. */
export const FLAG_COPY: Record<PhotoScreeningFlag, string> = {
  screenshot: "A screenshot",
  collage: "A collage",
  text_overlay: "Text on the photo",
  contact_details: "Contact details",
  watermark: "A watermark or another company's mark",
  stock_like: "Looks like a stock photo",
  people: "People in it",
  minors: "Children in it",
  unsafe: "Not safe to post",
};

export const CLEARABLE_FLAGS: readonly ClearablePhotoFlag[] = ["stock_like", "watermark"];

export const isClearable = (flag: PhotoScreeningFlag): flag is ClearablePhotoFlag => (CLEARABLE_FLAGS as readonly string[]).includes(flag);

const ISSUE_COPY: Record<string, string> = {
  too_small: "too small",
  low_resolution: "low resolution",
  blurry: "blurry",
  soft: "a little soft",
  too_dark: "too dark",
  dark: "a little dark",
  too_bright: "washed out",
  bright: "a little bright",
  flat: "flat",
  low_contrast: "low contrast",
  clipped: "parts lost to light or shadow",
  noisy: "grainy",
};

/** "blurry, too dark" from `quality.issues`. */
export function qualityIssuesText(issues: readonly string[] | null | undefined): string {
  return (issues ?? []).map((issue) => ISSUE_COPY[issue] ?? issue.replace(/_/g, " ")).join(", ");
}

export type PhotoStatusTone = "success" | "warning" | "neutral" | "info";

export type PhotoStatus = { tone: PhotoStatusTone; label: string; detail: string | null };

/** The flags still in force (not cleared with "Use anyway"). */
export function activeFlags(photo: PostMediaDetails): PhotoScreeningFlag[] {
  const screening = photo.screening;
  if (!screening) return [];
  const cleared = new Set<string>(screening.cleared ?? []);
  return (screening.flags ?? []).filter((flag) => !cleared.has(flag));
}

/** Where a library photo stands for automatic posts. */
export function photoStatus(photo: PostMediaDetails): PhotoStatus {
  const screening = photo.screening;
  if (!screening || screening.state === "pending") {
    return { tone: "info", label: "Being checked", detail: "We describe and check each new photo. It takes a few minutes." };
  }
  if (screening.state === "failed") {
    return {
      tone: "warning",
      label: "Couldn't be checked",
      detail: "It's checked again by itself in 3 days. To try now, take it out of the library and add it back.",
    };
  }
  const flags = activeFlags(photo);
  if (screening.state === "flagged" && flags.length > 0) {
    if (flags.every((flag) => flag === "people")) {
      return { tone: "warning", label: "Not for automatic publishing", detail: "It shows people, so posts that publish by themselves won't use it. Posts you check can." };
    }
    return { tone: "warning", label: "Kept out of automatic posts", detail: "You can still add it to a post yourself." };
  }
  const verdict = photo.quality?.verdict;
  if (verdict === "poor") {
    const issues = qualityIssuesText(photo.quality?.issues);
    return { tone: "warning", label: "Not picked automatically", detail: issues ? `It's ${issues}.` : "It's too blurry, dark or washed out." };
  }
  if (verdict === "enhance") return { tone: "success", label: "Ready to use", detail: "It gets a gentle touch-up when it's used." };
  return { tone: "success", label: "Ready to use", detail: null };
}

/** True while the job hasn't screened it yet. */
export function isPending(photo: PostMediaDetails): boolean {
  return Boolean(photo.library) && (!photo.screening || photo.screening.state === "pending");
}

/** Poll for a recent upload still being checked (an old pending photo waits for tomorrow's AI budget). */
export const SCREENING_POLL_WINDOW_MS = 10 * 60_000;

export function hasFreshPending(photos: readonly PostMediaDetails[], nowMs: number): boolean {
  return photos.some((photo) => {
    if (!isPending(photo)) return false;
    const created = Date.parse(photo.created_at ?? "");
    return Number.isFinite(created) && nowMs - created < SCREENING_POLL_WINDOW_MS;
  });
}

/** "Used twice · last Oct 2", "Not used yet". */
export function usageText(photo: PostMediaDetails): string {
  const count = photo.usage?.use_count ?? 0;
  if (count <= 0) return "Not used in a post yet";
  const times = count === 1 ? "once" : count === 2 ? "twice" : `${count} times`;
  const last = photo.usage?.last_used_at ? ` · last ${formatShortDate(photo.usage.last_used_at)}` : "";
  return `Used ${times}${last}`;
}

/** What a picture is, for the "Other photos" list. */
export function photoKindText(photo: PostMediaDetails): string {
  if (photo.label?.trim()) return photo.label.trim();
  if (photo.kind === "ai") return "AI-generated image, not a photo of your business";
  if (photo.kind === "enhanced") return "Enhanced from your photo";
  return "Your photo";
}

/** True for a photo that may join the library (only photos the business uploaded). */
export function canJoinLibrary(photo: PostMediaDetails): boolean {
  return photo.kind === "upload" && !photo.ai_generated;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

/** A failed upload of one file, as the rest of a sentence about it ("is already in your library"). */
export function uploadErrorText(err: unknown): { text: string; stop: boolean } {
  if (!isApiError(err)) return { text: "couldn't be uploaded. Try again.", stop: false };
  switch (err.reason) {
    case "library_full": {
      const limit = apiErrorData(err).limit;
      return { text: `wasn't added: your library is full (${typeof limit === "number" ? limit : LIBRARY_MAX} photos). Remove some to add more.`, stop: true };
    }
    case "library_duplicate":
      return { text: "is in your library already.", stop: false };
    case "media_too_large":
      return { text: "is too large: photos can be up to 5 MB and 50 megapixels.", stop: false };
    case "media_too_small":
      return { text: "is too small: it needs at least 250 × 250 pixels.", stop: false };
    case "media_too_plain":
      return { text: "has too little detail to use.", stop: false };
    case "media_type":
      return { text: "isn't a JPEG or PNG photo.", stop: false };
    case "media_unreadable":
      return { text: "couldn't be read. Try another file.", stop: false };
    case "invalid_upload":
      return { text: "couldn't be uploaded. Try again.", stop: false };
    case "read_only":
      return { text: `wasn't added. ${LIBRARY_READ_ONLY_TEXT}`, stop: true };
    case "subscription_required":
      return { text: "wasn't added: uploading needs an active subscription.", stop: true };
    case "organization_suspended":
      return { text: "wasn't added: this account is suspended.", stop: true };
    case "feature_not_included":
      return { text: "wasn't added: your plan doesn't include posts.", stop: true };
    default:
      if (err.status === 413) return { text: "is too large: photos can be up to 5 MB.", stop: false };
      return { text: "couldn't be uploaded. Try again.", stop: false };
  }
}

/** A failed change of a photo (caption, "Use anyway", in or out of the library). */
export function photoChangeErrorText(err: unknown): { text: string; reload: boolean } {
  if (!isApiError(err)) return { text: "This photo couldn't be changed. Try again.", reload: false };
  switch (err.reason) {
    case "library_full":
      return { text: `Your library is full (${LIBRARY_MAX} photos). Remove one to add another.`, reload: false };
    case "library_duplicate":
      return { text: "This photo is in your library already.", reload: true };
    case "library_uploads_only":
      return { text: "Only photos you upload can join the library: AI images and post pictures can't.", reload: false };
    case "not_in_library":
      return { text: "Only photos in your library can be marked OK. The list is reloaded.", reload: true };
    case "media_not_found":
      return { text: "This photo was deleted. The list is reloaded.", reload: true };
    case "read_only":
      return { text: LIBRARY_READ_ONLY_TEXT, reload: false };
    case "invalid_input":
      return { text: "A description needs 1 to 200 characters.", reload: false };
    default:
      return { text: "This photo couldn't be changed. Try again.", reload: err.status === 404 };
  }
}
