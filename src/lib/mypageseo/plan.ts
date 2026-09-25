/**
 * Plan-based feature availability.
 *
 * This reads the plan limits the billing contract already defines (the usage
 * metrics on the subscription: locations, tracked keywords, clients, reports).
 * It invents no plan, price or limit of its own — when the billing backend is
 * wired up, its usage payload flows straight through here.
 *
 * A plan limit is not a permission problem: the user is allowed to do this,
 * their current plan simply does not include more of it. The UI states the two
 * cases differently.
 */

import { getBilling, type BillingResult, type UsageMetric } from "./billing";
import type { AccountType } from "./navigation";

/** Usage metric ids the billing contract defines. */
export type PlanMetricId = "locations" | "keywords" | "clients" | "reports";

export type PlanLimitState = {
  /** The plan the organization is on, e.g. "Business". */
  planName: string;
  label: string;
  used: number;
  /** null when the plan does not limit this metric. */
  limit: number | null;
  remaining: number | null;
  /** True only when the plan defines a limit and it has been reached. */
  reached: boolean;
  /** True when usage is at or above 80% of a defined limit. */
  nearLimit: boolean;
};

export type PlanState = {
  status: BillingResult["status"];
  planName: string | null;
  metrics: Record<string, UsageMetric>;
  /** Resolves a metric the plan defines; null when the plan has no such metric. */
  limitFor: (metric: PlanMetricId) => PlanLimitState | null;
};

export function resolvePlan(
  accountType: AccountType,
  real?: BillingResult | null,
): PlanState {
  const billing = getBilling(accountType, real);
  if (billing.status !== "ready") {
    return {
      status: billing.status,
      planName: null,
      metrics: {},
      limitFor: () => null,
    };
  }

  const metrics: Record<string, UsageMetric> = {};
  for (const metric of billing.usage) metrics[metric.id] = metric;
  const planName = billing.subscription.planName;

  return {
    status: billing.status,
    planName,
    metrics,
    limitFor: (id) => {
      const metric = metrics[id];
      if (!metric) return null;
      const remaining = metric.limit === null ? null : Math.max(0, metric.limit - metric.used);
      return {
        planName,
        label: metric.label,
        used: metric.used,
        limit: metric.limit,
        remaining,
        reached: metric.limit !== null && metric.used >= metric.limit,
        nearLimit: metric.limit !== null && metric.limit > 0 && metric.used / metric.limit >= 0.8,
      };
    },
  };
}

/** Short, honest sentence for a reached limit. No prices, no invented tiers. */
export function planLimitMessage(state: PlanLimitState): string {
  if (state.limit === null) return "";
  return `Your ${state.planName} plan includes ${state.limit} ${state.label.toLowerCase()}, and all of them are in use. Change your plan to add more.`;
}

/** Short sentence when a plan is close to, but not at, its limit. */
export function planNearLimitMessage(state: PlanLimitState): string {
  if (state.limit === null || state.remaining === null) return "";
  return `${state.used} of ${state.limit} ${state.label.toLowerCase()} used on your ${state.planName} plan — ${state.remaining} left.`;
}
