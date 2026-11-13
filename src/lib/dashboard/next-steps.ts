/**
 * "Next steps" on the dashboard: the backend's `recommended_actions` (the top `MAX_NEXT_STEPS` by
 * impact) turned into tasks with one verb-first button each, pointing at the exact page (and filter)
 * where the work is done. Links go straight to `/locations/:id/…` (never a portfolio redirect).
 *
 * `toNextSteps` builds an editor's buttons; `nextStepCta` adapts one to the person looking:
 * read-only users get a link to look instead of a form they can't use, and reviews and posts
 * follow what AI can do right now.
 */
import type { DashboardAction } from "@/api";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { locationPath } from "@/lib/mypageseo/section-links";
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

/** Who is looking: whether they may change things, and what they can write right now. */
export type NextStepViewer = { canEdit: boolean; writing: WritingMode };

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
      return link("Open reviews", locationPath(id, "reputation"));
    case "citations":
      return link(
        "Check listings",
        locationPath(id, "citations", kind === "nap_wrong" || kind === "not_found" ? `?status=${kind}` : ""),
      );
    case "posts":
      if (kind === "failed") return link(lookOnly ? "See posts" : "Fix posts", locationPath(id, "gbp/posts", "?tab=problems"));
      if (kind === "approval") return link(lookOnly ? "See posts" : "Review posts", locationPath(id, "gbp/posts", "?tab=waiting"));
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
 * The words a step is shown with. The backend titles `reviews:attention` "N reviews need a reply or a
 * look", but N is `awaiting_attention`: the urgent reviews, while everywhere else "need a reply" means
 * every unanswered review (the Reviews tile's and the Reviews page's count, see `./replies`). So the
 * step says "N urgent reviews", with the count taken from the start of the title.
 */
function wordsFor(action: DashboardAction, source: NextStepSource, kind: string): { title: string; detail: string | null } {
  const detail = action.detail?.trim() || null;
  if (source === "reviews" && kind === "reply_rejected") {
    // The title as the backend writes it ("Google rejected 2 replies"); its detail says "Open Reviews",
    // while the button may open AI Review Replies, so the detail names no page.
    return { title: action.title, detail: "They aren't public. Read Google's reason on each, then write a new reply and send it." };
  }
  if (source !== "reviews" || kind !== "attention") return { title: action.title, detail };
  const count = /^\s*(\d[\d,]*)/.exec(action.title)?.[1];
  const urgent = count === undefined ? Number.NaN : Number(count.replace(/,/g, ""));
  return {
    title: Number.isFinite(urgent) ? `${urgent.toLocaleString()} urgent review${urgent === 1 ? "" : "s"}` : "Urgent reviews",
    detail: "Unanswered 1–3★ or flagged reviews. Answer these first.",
  };
}

/** Highest impact first; ties by location, then id, so the order never jumps between refreshes. */
export function toNextSteps(actions: readonly DashboardAction[]): NextStep[] {
  return sortRows(
    actions,
    byNumber((action) => action.impact, "desc"),
    byText((action) => action.location_name),
    byText((action) => action.id),
  ).map((action, index) => {
    const source = sourceOf(action);
    const kind = kindOf(action);
    const locationId = action.location_id ?? null;
    return {
      key: `${action.id}-${action.location_id ?? ""}-${index}`,
      source,
      kind,
      ...wordsFor(action, source, kind),
      locationId,
      locationName: action.location_name?.trim() || null,
      impact: action.impact,
      high: action.impact >= 0.7,
      cta: ctaFor(source, kind, locationId, EDITOR),
    };
  });
}
