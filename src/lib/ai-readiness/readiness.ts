/**
 * "Get the AI ready · N of M done" (Phase 25b/25c, `GET …/ai/readiness`), pure: what the location still lacks
 * for the AI to write specifically, as checklist rows.
 *
 * - Only the available checks show (the brief is left out while its switch is off); `done` of `total` counts them.
 * - `next` lists the available checks not done, in order: the first is what to do next, so those rows come
 *   first, then the done ones.
 * - Each row links to its screen: the business brief, AI Settings `#facts`, `#replies` (the signature), `#logo`,
 *   and the photo library. A client user gets the same links, worded to look rather than change.
 */
import type { AiReadiness, AiReadinessKey } from "@/api";
import { shortBusinessName } from "@/lib/ai-settings/names";
import { locationPath } from "@/lib/mypageseo/section-links";

/** The backend's order of the checks. */
export const READINESS_ORDER: readonly AiReadinessKey[] = ["brief", "owner_facts", "signature", "logo", "photos"];

export type ReadinessRow = {
  key: AiReadinessKey;
  done: boolean;
  /** The first check not done: what to do next. */
  next: boolean;
  title: string;
  /** Where it stands, from `details`. */
  detail: string;
  /** Where to do it. */
  to: string;
  /** The link's words: "Add facts", or "See facts" for someone who can't change it. */
  action: string;
};

const COUNT = new Intl.NumberFormat("en-US");
const n = (value: number | null | undefined) => COUNT.format(typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0);
const plural = (value: number, one: string, many: string) => `${n(value)} ${value === 1 ? one : many}`;

function briefRow(readiness: AiReadiness, done: boolean, canEdit: boolean, locationId: string): Omit<ReadinessRow, "key" | "done" | "next"> {
  const brief = readiness.details?.brief;
  const facts = brief?.facts ?? 0;
  const pending = brief?.suggestions_pending ?? 0;
  const status = brief?.status ?? "none";
  const suggestions = pending > 0 ? ` · ${plural(pending, "suggestion", "suggestions")} to confirm` : "";
  let detail: string;
  if (done) detail = `${plural(facts, "fact", "facts")} from your website the AI can use${suggestions}`;
  else if (status === "queued" || status === "building") detail = "Reading your website now. This can take a few minutes.";
  else if (status === "failed") detail = "It couldn't be built. Read your website again.";
  else if (status === "ready") detail = `Nothing from your website the AI can use yet${suggestions}`;
  else detail = "The AI reads your website and notes your services, FAQs and what sets you apart.";
  const action = !canEdit ? "See the brief" : status === "none" ? "Build it" : "Open the brief";
  return { title: "Business brief", detail, to: locationPath(locationId, "ai/brief"), action };
}

/** "How your review replies are signed, like “The team at Harbor Dental”." (no example without a name). */
function signatureHint(locationName: string | undefined): string {
  const business = shortBusinessName(locationName);
  return business ? `How your review replies are signed, like “The team at ${business}”.` : "How your review replies are signed.";
}

function rowCopy(
  key: AiReadinessKey,
  readiness: AiReadiness,
  done: boolean,
  canEdit: boolean,
  locationId: string,
  locationName: string | undefined,
): Omit<ReadinessRow, "key" | "done" | "next"> {
  const details = readiness.details ?? {};
  switch (key) {
    case "brief":
      return briefRow(readiness, done, canEdit, locationId);
    case "owner_facts": {
      const active = details.owner_facts?.active ?? 0;
      const recommended = details.owner_facts?.recommended ?? 3;
      return {
        title: "Facts for the AI",
        detail: done
          ? `${plural(active, "fact", "facts")} ${canEdit ? "of yours" : "of the business's"} the AI can state`
          : canEdit
            ? `${n(active)} of ${n(recommended)} added. Add facts only you know, like parking, payment or who runs the place.`
            : `${n(active)} of ${n(recommended)} added: facts only the business knows, like parking, payment or who runs the place.`,
        to: locationPath(locationId, "ai/settings", "#facts"),
        action: canEdit ? "Add facts" : "See facts",
      };
    }
    case "signature": {
      const value = details.signature?.value?.trim();
      return {
        title: "Reply signature",
        detail: done && value ? `Replies are signed “${value}”` : done ? "Set" : signatureHint(locationName),
        to: locationPath(locationId, "ai/settings", "#replies"),
        action: canEdit ? (done ? "Change it" : "Add a signature") : "See it",
      };
    }
    case "logo": {
      const source = details.logo?.source;
      return {
        title: "Your logo",
        detail: done ? (source === "website" ? "Set, from your website. It goes on your post pictures." : "Set. It goes on your post pictures.") : "It goes on your post pictures, in a quiet corner.",
        to: locationPath(locationId, "ai/settings", "#logo"),
        action: canEdit ? (done ? "Change it" : "Add your logo") : "See it",
      };
    }
    case "photos": {
      const photos = details.photos;
      const library = photos?.library ?? 0;
      const parts = [
        `${plural(library, "photo", "photos")} in your library`,
        `${n(photos?.usable)} ready to use`,
        ...(photos?.pending ? [`${n(photos.pending)} being checked`] : []),
        ...(photos?.flagged ? [`${n(photos.flagged)} kept out`] : []),
      ];
      return {
        title: "Photos of your business",
        detail:
          library === 0
            ? canEdit
              ? "AI posts use your own photos first. Add photos of your work, your team and your place."
              : "AI posts use the business's own photos first, before making a picture."
            : parts.join(" · "),
        to: locationPath(locationId, "ai/photos"),
        action: canEdit ? "Add photos" : "See photos",
      };
    }
  }
}

/**
 * The checklist's rows: the available checks, what to do next first, then the done ones. `locationName` gives the
 * signature its example ("The team at Harbor Dental"), as the signature field's placeholder does.
 */
export function readinessRows(readiness: AiReadiness, locationId: string, canEdit: boolean, locationName?: string): ReadinessRow[] {
  const checks = readiness.checks ?? ({} as AiReadiness["checks"]);
  const available = READINESS_ORDER.filter((key) => checks[key]?.available);
  const isDone = (key: AiReadinessKey) => Boolean(checks[key]?.done);
  const nextOrder = (readiness.next ?? []).filter((key) => available.includes(key) && !isDone(key));
  const todo = [...nextOrder, ...available.filter((key) => !isDone(key) && !nextOrder.includes(key))];
  const done = available.filter(isDone);
  return [...todo, ...done].map((key, index) => ({
    key,
    done: isDone(key),
    next: index === 0 && !isDone(key),
    ...rowCopy(key, readiness, isDone(key), canEdit, locationId, locationName),
  }));
}

/** "2 of 5 done" from the answer's counts (the available checks). */
export function readinessCount(readiness: AiReadiness): { done: number; total: number } {
  const total = Math.max(0, readiness.total ?? 0);
  return { done: Math.min(total, Math.max(0, readiness.done ?? 0)), total };
}
