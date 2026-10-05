import { resolvePlan, type PlanLimitState, type PlanMetricId, type PlanState } from "@/lib/mypageseo/plan";
import { useAccountType } from "@/lib/mypageseo/workspace";

/** Plan limits for the current organization. */
export function usePlan(): PlanState {
  return resolvePlan(useAccountType());
}

/** Convenience hook for a single metric the plan defines. */
export function usePlanLimit(metric: PlanMetricId): PlanLimitState | null {
  return usePlan().limitFor(metric);
}
