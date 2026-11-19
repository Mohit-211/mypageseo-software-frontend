/**
 * `useAiStatus(locationId)`: can AI run right now, and if not, why. One answer for every AI button,
 * banner, card and page, so AI features are never hidden: they show *why* they can't run instead.
 *
 * Sources, freshest wins:
 * - the location's `GET reviews/summary` (free, no AI): `ai.configured`, `ai.paused_today`,
 *   `ai.token_costs`, `ai.token_balance`. It reuses `reviewsSummaryQuery` from
 *   `src/lib/reviews/use-reviews.ts`, so the cache is shared with the Reviews page and the
 *   LocationsLayout prefetch (usually warm). The AI switch and the daily budget are server-wide, so any
 *   location of the organization gives the same answer: on org-wide pages pass the workspace's active
 *   location. Without a location the state is "unknown" (unless this session already learned more);
 * - what AI calls in this session said (`src/lib/ai/ai-signal.ts`: `toastAiError` / `noteAiError` /
 *   `noteAiSuccess`), used when it is newer than the summary or the summary can't answer. Posts,
 *   reviews and keyword ideas all report their AI errors there (the old posts-only flag is gone).
 *
 * States:
 * - `checking`: a location's summary is loading for the first time;
 * - `ready`: AI is on and under today's budget;
 * - `paused`: today's AI budget is used up (everyone's, or since Phase 25b this organization's share of it:
 *   `ai_org_budget_reached`, which the summary's `paused_today` also reports); `resumesAt` is the local time of
 *   the next 00:00 UTC;
 * - `off`: AI isn't switched on yet (503 `ai_not_configured`). Show "AI is almost ready", keep the
 *   feature visible and disabled with `reason`;
 * - `unknown`: no location, or the summary failed (e.g. 403 `feature_not_included` on a plan without
 *   reviews). Let the click decide and handle errors with `toastAiError`.
 *
 * `canRun` = the user may write (`useCanEdit()`: not a client_user) && the organization isn't read-only
 * or suspended (`useOrganizationUsage()` + `useAccountRestriction()`) && the state is ready or unknown.
 *
 * `GET posts/summary` carries the same `ai` block (`configured`, `paused_today`, `token_costs`). It isn't read here
 * (it would add a request on pages that don't load it); it could stand in when the reviews summary can't answer.
 */
import { useQuery } from "@tanstack/react-query";
import type { ReviewsSummary } from "@/api";
import { useCanEdit } from "@/hooks/use-access";
import {
  resolveAccountRestriction,
  useAccountRestriction,
  useBilling,
  useOrganizationUsage,
  type AccountRestriction,
} from "@/lib/billing/use-billing";
import { reviewsSummaryQuery } from "@/lib/reviews/use-reviews";
import { DEFAULT_AI_COSTS, NO_LOCATION, resolveAiCosts, type AiCosts } from "./ai-costs";
import { clearAiSignal, useAiSignal, type AiSessionSignal } from "./ai-signal";
import { formatResumeTime, nextUtcMidnight } from "./ai-time";

export type AiState = "checking" | "ready" | "paused" | "off" | "unknown";

/** What stops AI actions, most lasting first: the user's role, the account, then AI itself. */
export type AiBlocker = "role" | "suspended" | "subscription" | "off" | "paused" | "checking";

export type AiStatus = {
  state: AiState;
  /** Enable AI buttons only when true. */
  canRun: boolean;
  /** Why AI actions are disabled, ready to show (tooltip, hint line). Undefined when they can run, and while checking. */
  reason?: string;
  /** What blocks AI actions; undefined when `canRun`. */
  blockedBy?: AiBlocker;
  /** When paused: the local time AI comes back, e.g. "7:00 PM" or "5:30 AM tomorrow" (the next 00:00 UTC). */
  resumesAt?: string;
  /** The same instant as an ISO string, for `<time dateTime>` or a countdown. */
  resumesAtIso?: string;
  /** Tokens per AI action (`useAiCosts` sources). */
  costs: AiCosts;
  /** The token balance when known: billing, else the reviews summary, else the organization usage. */
  balance?: number;
  /** Looks again: forgets this session's AI signal and refetches the location's summary. */
  refresh: () => void;
};

/** The availability part of the summary's `ai` block. */
export type AiAvailability = { configured: boolean; paused_today: boolean };

/** AI availability from a summary's `ai` block (pure). No block (not loaded, failed, no location) → "unknown". */
export function deriveAiState(summary: { ai?: AiAvailability | null } | null | undefined): "ready" | "paused" | "off" | "unknown" {
  const ai = summary?.ai;
  if (!ai) return "unknown";
  if (!ai.configured) return "off";
  return ai.paused_today ? "paused" : "ready";
}

export type AiStatusInput = {
  /** The summary's `ai` block once loaded; null or undefined when not loaded, failed, or no location. */
  ai?: AiAvailability | null;
  /** When `ai` was fetched (a query's `dataUpdatedAt`, ms since epoch). */
  aiUpdatedAt?: number;
  /** A location's summary is loading for the first time. */
  pending?: boolean;
  /** This session's latest AI call outcome (`useAiSignal()`). */
  signal?: AiSessionSignal | null;
  /** `useCanEdit()`: false for a client_user. */
  canEdit: boolean;
  /** A read-only (402 `subscription_required`) or suspended organization. */
  restriction?: AccountRestriction;
  costs?: AiCosts;
  balance?: number;
};

const BLOCKED_REASON: Record<"role" | "suspended" | "subscription" | "off", string> = {
  role: "Your access is read-only.",
  suspended: "This account is suspended.",
  subscription: "AI needs an active subscription.",
  off: "AI is almost ready, but it isn't switched on yet.",
};

/** The whole status from its inputs (pure; `useAiStatus` gathers the inputs). Exported for tests. */
export function computeAiStatus(input: AiStatusInput): Omit<AiStatus, "refresh"> {
  const fromSummary = deriveAiState({ ai: input.ai });
  const summaryAt = input.aiUpdatedAt ?? 0;
  const signal = input.signal ?? null;

  let state: AiState;
  let learnedAt: number | undefined;
  if (signal && (fromSummary === "unknown" || signal.at > summaryAt)) {
    state = signal.kind;
    learnedAt = signal.at;
  } else if (fromSummary !== "unknown") {
    state = fromSummary;
    learnedAt = input.aiUpdatedAt;
  } else {
    state = input.pending ? "checking" : "unknown";
  }

  // The budget resets at 00:00 UTC after the moment we learned it was used up.
  const resumeMs = state === "paused" && learnedAt ? nextUtcMidnight(learnedAt) : undefined;
  const resumesAt = resumeMs !== undefined && learnedAt ? formatResumeTime(resumeMs, learnedAt) : undefined;

  const blockedBy: AiBlocker | undefined = !input.canEdit
    ? "role"
    : input.restriction === "suspended"
      ? "suspended"
      : input.restriction === "read_only"
        ? "subscription"
        : state === "off" || state === "paused" || state === "checking"
          ? state
          : undefined;

  let reason: string | undefined;
  if (blockedBy === "paused") reason = `AI is paused for today. ${resumesAt ? `It's back at ${resumesAt}.` : "Try again later."}`;
  else if (blockedBy && blockedBy !== "checking") reason = BLOCKED_REASON[blockedBy];

  return {
    state,
    canRun: blockedBy === undefined,
    reason,
    blockedBy,
    resumesAt,
    resumesAtIso: resumeMs !== undefined ? new Date(resumeMs).toISOString() : undefined,
    costs: input.costs ?? DEFAULT_AI_COSTS,
    balance: input.balance,
  };
}

// While paused, look again every 10 minutes so an open page comes back on its own after 00:00 UTC.
const PAUSED_POLL_MS = 10 * 60_000;

const selectAi = (summary: ReviewsSummary) => summary.ai ?? null;

/** AI availability, permission and prices for a location (see the file comment). */
export function useAiStatus(locationId?: string | null): AiStatus {
  const summary = useQuery({
    ...reviewsSummaryQuery(locationId ?? NO_LOCATION),
    enabled: Boolean(locationId),
    select: selectAi,
    refetchInterval: (query) => (query.state.data?.ai?.paused_today ? PAUSED_POLL_MS : false),
  });
  const signal = useAiSignal();
  const canEdit = useCanEdit();
  const billing = useBilling().data;
  const usage = useOrganizationUsage().data;
  const seen = useAccountRestriction();

  const ai = summary.data ?? null;
  // Same rules as the shell's AccountStateBanner, plus a 402/403 seen on any call this session.
  const restriction = resolveAccountRestriction(usage?.billing, seen);

  const status = computeAiStatus({
    ai,
    aiUpdatedAt: summary.dataUpdatedAt,
    pending: Boolean(locationId) && summary.isPending,
    signal,
    canEdit,
    restriction,
    costs: resolveAiCosts(billing?.tokens?.ai_costs, ai?.token_costs),
    balance: billing?.tokens?.balance ?? ai?.token_balance ?? usage?.tokens?.balance,
  });

  const refetch = summary.refetch;
  const refresh = () => {
    clearAiSignal();
    if (locationId) void refetch();
  };
  return { ...status, refresh };
}

export type AiStatusCopy = {
  kind: "off" | "paused" | "role";
  title: string;
  /** One or two calm sentences for a banner. */
  description: string;
  /** One short sentence for tight spots (a compact banner, a card, a dialog). */
  short: string;
};

/**
 * What to tell people about AI availability, or null when there's nothing to say (ready, unknown,
 * checking, or a read-only / suspended account, which the shell's account banner already explains).
 * Never mentions "the server": AI being off is presented as "almost ready".
 */
export function aiStatusCopy(status: Pick<AiStatus, "state" | "blockedBy" | "resumesAt">): AiStatusCopy | null {
  // A client_user can't run AI at all, so "write it yourself" would be wrong for them too.
  if (status.blockedBy === "role") {
    return {
      kind: "role",
      title: "Your agency runs AI for this account",
      description: "You can see everything here. The team that manages your account writes and sends with AI.",
      short: "The team that manages your account runs AI.",
    };
  }
  if (status.blockedBy === "subscription" || status.blockedBy === "suspended") return null;
  if (status.state === "off") {
    return {
      kind: "off",
      title: "AI is almost ready",
      description: "We're switching on AI writing in MyPageSEO. Until then, you can write posts and replies yourself, and everything you write works the same way.",
      short: "Until it's on, you can write posts and replies yourself.",
    };
  }
  if (status.state === "paused") {
    const back = status.resumesAt ? `It's back at ${status.resumesAt}.` : "It's back within a day.";
    return {
      kind: "paused",
      title: "AI is paused for today",
      description: `Today's AI limit has been reached. ${back} Until then, you can keep writing and sending yourself.`,
      short: back,
    };
  }
  return null;
}
