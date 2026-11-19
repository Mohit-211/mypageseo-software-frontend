/**
 * "Next steps" on the dashboard: the backend's `recommended_actions` (the top `MAX_NEXT_STEPS` by
 * impact) turned into tasks with one verb-first button each, pointing at the exact page (and filter)
 * where the work is done. Links go straight to `/locations/:id/…` (never a portfolio redirect).
 *
 * `toNextSteps` builds an editor's buttons; `nextStepCta` adapts one to the person looking:
 * read-only users get a link to look instead of a form they can't use, and reviews and posts
 * follow what AI can do right now.
 *
 * 2026-11-17: an action's `id` is its kind (`reviews:attention`, `posts:approval`, …), so it repeats
 * across locations: a step is keyed by `location_id` + `id`. Titles and details are shown as the
 * backend writes them ("N urgent reviews"; no detail names an app page any more, the buttons choose
 * the page for each viewer).
 */
import type { DashboardAction } from "@/api";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { locationPath } from "@/lib/mypageseo/section-links";
import { reviewQueuePath } from "@/lib/posts/review-queue";
import { byNumber, byText, sortRows } from "@/lib/sort";
import { needsReplyPath, replyLink, urgentReplyLink, type WritingMode } from "./replies";

/** The backend sends at most this many actions (`MAX_ACTIONS` in its dashboard actions service). */
export const MAX_NEXT_STEPS = 5;

export type NextStepSource = "connection" | "setup" | "ranking" | "gbp" | "reviews" | "citations" | "posts" | "other";

/** A link to the page that fixes it, or the Google connect dialog (connection problems). */
export type NextStepCta = { kind: "link"; label: string; to: string } | { kind: "connect"; label: string };

export type NextStep = {
  key: string;
  source: NextStepSource;
  /** The action's kind, after the source in its id (`reviews:attention` → "attention"). */
  kind: string;
  title: string;
  detail: string | null;
  locationId: string | null;
  locationName: string | null;
  /** 0–1 from the backend; the list is ordered by it. */
  impact: number;
  /** Worth doing first (impact 0.7 and above). */
  high: boolean;
  /** The button for an editor while AI can run; `nextStepCta` adapts it to the person looking. */
  cta: NextStepCta;
};

/**
 * Who is looking: whether they may change things, and what they can write right now. `aiPostsWaiting`: the
 * locations whose waiting posts include AI posts (the review queue, `GET /posts/review`), so "N posts wait for
 * approval" opens "Posts to review" on that location; unknown or other locations open the location's waiting posts.
 */
export type NextStepViewer = { canEdit: boolean; writing: WritingMode; aiPostsWaiting?: ReadonlySet<string> | undefined };

const EDITOR: NextStepViewer = { canEdit: true, writing: "ai" };

const SOURCES: readonly NextStepSource[] = ["connection", "setup", "ranking", "gbp", "reviews", "citations", "posts"];

function sourceOf(action: DashboardAction): NextStepSource {
  return (SOURCES as readonly string[]).includes(action.source) ? (action.source as NextStepSource) : "other";
}

/** Action ids read "<source>:<kind>" (e.g. `reviews:attention`), sometimes with more parts after it. */
function kindOf(action: DashboardAction): string {
  return action.id.split(":")[1] ?? "";
}

const link = (label: string, to: string): NextStepCta => ({ kind: "link", label, to });

/**
 * The button for one action: what to do, and where. Read-only users (and accounts that can't make
 * changes right now) get a link to look at the same thing, never a setup screen or an editor.
 */
function ctaFor(source: NextStepSource, kind: string, id: string | null, viewer: NextStepViewer): NextStepCta {
  // A Google connection is restored in the connect dialog, wherever the user is.
  if (source === "connection") return { kind: "connect", label: kind === "connect" ? "Connect Google" : "Reconnect Google" };
  if (!id) return link("Open locations", "/locations");
  const lookOnly = !viewer.canEdit || viewer.writing === "view";
  switch (source) {
    case "setup":
      return viewer.canEdit ? link("Finish setup", locationSetupPath(id)) : link("Open location", locationPath(id));
    case "ranking":
      // The backend's text says "Compare their reviews, categories and posts": that's Profile Comparison.
      return kind === "competitor_ahead"
        ? link("Compare profiles", locationPath(id, "gbp/comparison"))
        : link("Check rankings", locationPath(id, "rankings"));
    case "gbp":
      return link("Improve profile", locationPath(id, "gbp/audit"));
    case "reviews":
      if (kind === "suspicious") return link("Check the review", locationPath(id, "reputation", "?flag=suspicious"));
      if (kind === "attention") {
        // The urgent reviews (`awaiting_attention`): open the unanswered 1–3★ list. AI drafts clear
        // it fastest (nothing is sent before it's approved).
        const urgent = urgentReplyLink(lookOnly ? "view" : viewer.writing, id);
        return link(urgent.label, urgent.to);
      }
      if (kind === "unreplied") {
        // Every review without a reply, the list the Reviews page counts as "Needs reply".
        if (lookOnly) return link("Open reviews", needsReplyPath(id));
        const reply = replyLink(viewer.writing, id);
        return link(reply.label, reply.to);
      }
      if (kind === "reply_rejected") {
        // Phase 25a: replies Google didn't publish. AI Review Replies' "Rejected by Google" view drafts
        // new ones; with AI off they're written on Reviews, and read-only users just look there.
        const rejectedReviews = locationPath(id, "reputation", "?reply=rejected");
        if (lookOnly) return link("Open reviews", rejectedReviews);
        return link("Write new replies", viewer.writing === "ai" ? locationPath(id, "ai/replies", "?filter=rejected") : rejectedReviews);
      }
      if (kind === "auto_reply_paused") {
        // Phase 25b: Google rejected an automatic reply, Google restricted the account, or MyPageSEO paused
        // them. The automatic replies card on AI Settings says why and who may resume them (client users
        // read it too: their consent may be what resumes them).
        return link(lookOnly ? "See automatic replies" : "Check automatic replies", locationPath(id, "ai/settings", "#auto-replies"));
      }
      return link("Open reviews", locationPath(id, "reputation"));
    case "citations":
      return link(
        "Check listings",
        locationPath(id, "citations", kind === "nap_wrong" || kind === "not_found" ? `?status=${kind}` : ""),
      );
    case "posts":
      if (kind === "failed") return link(lookOnly ? "See posts" : "Fix posts", locationPath(id, "gbp/posts", "?tab=problems"));
      if (kind === "approval") {
        // AI posts waiting at this location: "Posts to review" (narrowed to it) shows them with their flagged
        // words and approves several at once (a client user approves there too). The location's waiting
        // posts otherwise: a person's posts waiting for the owner or the client aren't in that queue.
        if (viewer.aiPostsWaiting?.has(id)) return link("Review posts", reviewQueuePath(id));
        return link(lookOnly ? "See posts" : "Review posts", locationPath(id, "gbp/posts", "?tab=waiting"));
      }
      if (kind === "stale") {
        if (lookOnly) return link("Open posts", locationPath(id, "gbp/posts"));
        return viewer.writing === "ai"
          ? link("Get post ideas", locationPath(id, "ai/posts", "#ideas"))
          : link("Write a post", locationPath(id, "gbp/posts", "?compose=1"));
      }
      // The series and their problems are in the Auto-posts section, below the ideas.
      if (kind === "series_problem") return link("Check auto-posting", locationPath(id, "ai/posts", "#auto"));
      return link("Open posts", locationPath(id, "gbp/posts"));
    default:
      return link("Open location", locationPath(id));
  }
}

/** The step's button for the person looking (null: nothing they can do, e.g. connect Google read-only). */
export function nextStepCta(step: NextStep, viewer: NextStepViewer): NextStepCta | null {
  if (step.source === "connection" && !viewer.canEdit) return null;
  return ctaFor(step.source, step.kind, step.locationId, viewer);
}

/**
 * A step's key: its location and its kind (`location_id` + `id`, unique in one answer). Should the same pair
 * come twice, the repeat gets a number, so React never sees two rows with one key.
 */
function stepKeys(actions: readonly DashboardAction[]): string[] {
  const seen = new Map<string, number>();
  return actions.map((action) => {
    const base = `${action.location_id ?? "organization"}:${action.id}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}#${count + 1}`;
  });
}

/**
 * Highest impact first; ties by location, then id, so the order never jumps between refreshes. Titles and
 * details are the backend's (`reviews:attention` reads "N urgent reviews" there since 2026-11-17).
 */
export function toNextSteps(actions: readonly DashboardAction[]): NextStep[] {
  const sorted = sortRows(
    actions,
    byNumber((action) => action.impact, "desc"),
    byText((action) => action.location_name),
    byText((action) => action.id),
  );
  const keys = stepKeys(sorted);
  return sorted.map((action, index) => {
    const source = sourceOf(action);
    const kind = kindOf(action);
    const locationId = action.location_id ?? null;
    return {
      key: keys[index] ?? `${locationId ?? "organization"}:${action.id}`,
      source,
      kind,
      title: action.title,
      detail: action.detail?.trim() || null,
      locationId,
      locationName: action.location_name?.trim() || null,
      impact: action.impact,
      high: action.impact >= 0.7,
      cta: ctaFor(source, kind, locationId, EDITOR),
    };
  });
}

/** The locations of "N posts wait for approval" steps (`posts:approval`), to ask the review queue about. */
export function approvalStepLocations(steps: readonly NextStep[]): string[] {
  const ids = steps.filter((step) => step.source === "posts" && step.kind === "approval" && step.locationId).map((step) => step.locationId as string);
  return [...new Set(ids)];
}
