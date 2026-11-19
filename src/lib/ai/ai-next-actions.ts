/**
 * AI Studio's "Next best actions": what AI (or the user) should do next for one location, built only
 * from real data (pure; the page gathers the inputs from free GET calls, no AI).
 *
 * Rules, most useful first (at most `MAX_AI_NEXT_ACTIONS`):
 * 1. Google isn't connected → connect it (reviews and publishing need it);
 * 2. reviews without a reply or a draft (`summary.ai.draftable`) → draft replies (`ai.draft_all_cost`: the
 *    tokens of the blocks of 10 replies needed beyond the location's replies left);
 * 3. reply drafts waiting (`stats.drafts_pending`) → check and send them (free);
 * 4. no Google post in the last 30 days (`posts summary`) → post ideas (free since 2026-11-17);
 * 5. an auto-post series has a problem (`stats.series_problems`) → fix it;
 * 6. no tracked keywords → add keywords (keyword ideas are free);
 * 7. review insights never generated and enough reviews to read → generate them (`insights`).
 *
 * When AI can't run, the list never sends people to a button they can't press:
 * - AI switched off or paused for today: rows that are still useful by hand stay with a manual call
 *   to action ("Reply now", "Write a post"), saying when AI is back if it's paused; rows that only AI
 *   can do are left out.
 * - A read-only (no subscription) or suspended account: sending replies, publishing posts and adding
 *   keywords are refused too (the backend's `requireBilling`), so those rows are left out and one
 *   "account_blocked" row comes first instead, leading to billing or to support.
 */
import { locationPath } from "@/lib/mypageseo/section-links";
import type { AiCosts } from "./ai-costs";
import type { AiBlocker } from "./ai-status";

export const MAX_AI_NEXT_ACTIONS = 5;

export type AiNextActionId =
  | "account_blocked"
  | "connect_google"
  | "draft_replies"
  | "send_drafts"
  | "post_ideas"
  | "series_problem"
  | "add_keywords"
  | "insights";

export type AiNextAction = {
  id: AiNextActionId;
  title: string;
  description: string;
  /** Tokens it costs (0 = free); undefined shows no price. */
  cost?: number;
  /** Button label, verb first. */
  cta: string;
  /** Where the button goes; undefined for "connect_google", which opens the Google connect dialog. */
  to?: string;
  /** The action runs AI (violet button) rather than a plain step. */
  ai: boolean;
};

export type AiNextActionsInput = {
  locationId: string;
  /** `useAiStatus().canRun`. */
  canRun: boolean;
  /** `useAiStatus().blockedBy`: what stops AI when `canRun` is false. */
  blockedBy?: AiBlocker | undefined;
  /** `useAiStatus().resumesAt`: when paused AI is back, e.g. "7:00 PM". */
  resumesAt?: string | undefined;
  /** The user can pay (`billing.manage`, the owner). Default true; others are told to ask the owner. */
  canPay?: boolean | undefined;
  /** Reviews summary facts; null while unknown (loading, failed, not in the plan). */
  reviews: {
    gbpConnected: boolean;
    v4Enabled: boolean;
    total: number;
    /** Reviews with no reply and no draft (all of them, suspicious ones included). */
    waiting: number;
    /** Of those, the ones AI can draft now (`summary.ai.draftable`). */
    draftable: number;
    draftAllCost?: number;
    draftsPending: number;
  } | null;
  /** Posts summary facts; null while unknown. */
  posts: { gbpConnected: boolean; publishedLast30Days: number; seriesProblems: number } | null;
  /** Tracked keywords; null while unknown. */
  keywordCount: number | null;
  /** Review insights: generated, never generated, or unknown. */
  insights: "present" | "none" | null;
  costs: AiCosts;
};

/** Below this many reviews, insights have too little to read. */
const MIN_REVIEWS_FOR_INSIGHTS = 5;

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

/**
 * The first row for a read-only or suspended account. Only the owner can subscribe, so a member is
 * told to ask the owner (as the shell's account banner does); a suspended account goes to support.
 */
function accountBlockedAction(blocker: "subscription" | "suspended", canPay: boolean): AiNextAction {
  if (blocker === "suspended") {
    return {
      id: "account_blocked",
      title: "This account is suspended",
      description: "Sending replies, publishing posts and AI are paused. Contact support to restore access; your data is kept.",
      cta: "Contact support",
      // Straight to the new-ticket form, as the shell's account banner does.
      to: "/support?new=1",
      ai: false,
    };
  }
  return {
    id: "account_blocked",
    title: canPay ? "Subscribe to reply to reviews and publish posts" : "Ask the account owner to subscribe",
    description: canPay
      ? "Your account is read-only: sending replies, publishing posts and AI are paused until you subscribe. Drafts you save are kept."
      : "Your account is read-only: sending replies, publishing posts and AI are paused until the owner subscribes. Drafts you save are kept.",
    cta: canPay ? "Go to billing" : "See billing",
    to: "/settings/billing",
    ai: false,
  };
}

export function buildAiNextActions(input: AiNextActionsInput): AiNextAction[] {
  const { locationId: id, canRun, reviews, posts, costs } = input;
  const actions: AiNextAction[] = [];
  const connected = reviews ? reviews.gbpConnected : posts ? posts.gbpConnected : null;
  // Why AI can't run, if it can't: the account (the backend then refuses sending and publishing too)
  // or AI itself (off or paused: writing by hand still works).
  const blocker = canRun ? undefined : input.blockedBy;
  const accountBlocked = blocker === "subscription" || blocker === "suspended";
  const aiBack = input.resumesAt ? `back at ${input.resumesAt}` : "back within a day";

  if (blocker === "subscription" || blocker === "suspended") actions.push(accountBlockedAction(blocker, input.canPay ?? true));

  if (connected === false) {
    actions.push({
      id: "connect_google",
      title: "Connect your Google Business Profile",
      description: "Reviews and posts come from Google. Connect it to reply to reviews and publish posts from here.",
      cta: "Connect Google",
      ai: false,
    });
  }

  const reviewsReady = Boolean(reviews?.gbpConnected && reviews.v4Enabled);
  if (!accountBlocked && reviews && reviewsReady && (canRun ? reviews.draftable : reviews.waiting) > 0) {
    actions.push({
      id: "draft_replies",
      // "No reply yet", as on the queue view it opens: "need a reply" counts drafts too (Reviews page).
      title: canRun
        ? `${plural(reviews.draftable, "review is", "reviews are")} ready for an AI reply`
        : `${plural(reviews.waiting, "review has", "reviews have")} no reply yet`,
      description: canRun
        ? "AI drafts a reply to each one, in the reviewer's language. You check every draft before it's sent."
        : blocker === "paused"
          ? `AI is ${aiBack}. Reply to them yourself meanwhile.`
          : "Reply to them yourself now; drafting them with AI is almost ready.",
      ...(canRun && reviews.draftAllCost !== undefined ? { cost: reviews.draftAllCost } : {}),
      cta: canRun ? "Draft replies" : "Reply now",
      to: canRun ? locationPath(id, "ai/replies") : locationPath(id, "ai/replies", "?filter=none"),
      ai: canRun,
    });
  }

  if (!accountBlocked && reviews && reviewsReady && reviews.draftsPending > 0) {
    actions.push({
      id: "send_drafts",
      title: `${plural(reviews.draftsPending, "reply draft is", "reply drafts are")} ready to check`,
      description: "Read them, edit anything you like, then send them to Google. Sending is free.",
      cost: 0,
      cta: "Check drafts",
      to: locationPath(id, "ai/replies", "?filter=drafts"),
      ai: false,
    });
  }

  if (!accountBlocked && posts && posts.gbpConnected && posts.publishedLast30Days === 0) {
    actions.push({
      id: "post_ideas",
      title: "No Google post in the last 30 days",
      description: canRun
        ? "Regular posts keep your profile active. Post ideas for this business are free."
        : blocker === "paused"
          ? `Regular posts keep your profile active. Write one now; AI ideas are ${aiBack}.`
          : "Regular posts keep your profile active. Write one now; AI ideas are almost ready.",
      // Planned free since 2026-11-17 (no topics price any more).
      ...(canRun ? { cost: costs.post_ideas } : {}),
      cta: canRun ? "Get post ideas" : "Write a post",
      // Straight to the section: the old `?ideas=1` cost AI Posts an extra navigation (a blank frame).
      to: canRun ? locationPath(id, "ai/posts", "#ideas") : locationPath(id, "ai/posts"),
      ai: canRun,
    });
  }

  // 2026-11-17 (G10): `series_problems` counts a series that paused itself (posts not reviewed in time, posts held,
  // a post Google rejected) always, and one whose last post failed only while the planner is on: words for both.
  if (posts && posts.seriesProblems > 0) {
    actions.push({
      id: "series_problem",
      title: posts.seriesProblems === 1 ? "An auto-post series needs attention" : `${posts.seriesProblems} auto-post series need attention`,
      description:
        posts.seriesProblems === 1
          ? "It paused itself or couldn't write a post. See what happened and fix it."
          : "Each one paused itself or couldn't write a post. See what happened and fix them.",
      cta: "Review auto-posts",
      to: locationPath(id, "ai/posts", "#auto"),
      ai: false,
    });
  }

  // Saving keywords is refused for a read-only or suspended account (`PUT tracking` needs billing).
  if (!accountBlocked && input.keywordCount === 0) {
    actions.push({
      id: "add_keywords",
      title: "Add the searches you want to be found for",
      description: "AI weaves your keywords into posts and replies, and rankings track them. Keyword ideas are free.",
      cost: 0,
      cta: "Add keywords",
      to: locationPath(id, "keywords"),
      ai: false,
    });
  }

  if (canRun && input.insights === "none" && reviews && reviewsReady && reviews.total >= MIN_REVIEWS_FOR_INSIGHTS) {
    actions.push({
      id: "insights",
      title: "See what customers say",
      description: "AI sums up the themes, praise and complaints in your recent reviews.",
      cost: costs.insights,
      cta: "Generate insights",
      to: locationPath(id, "reputation/insights"),
      ai: true,
    });
  }

  return actions.slice(0, MAX_AI_NEXT_ACTIONS);
}
