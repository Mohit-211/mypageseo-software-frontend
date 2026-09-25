import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Gauge, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  planLimitMessage,
  planNearLimitMessage,
  resolvePlan,
  type PlanLimitState,
  type PlanMetricId,
  type PlanState,
} from "@/lib/mypageseo/plan";
import { useAccountType } from "@/lib/mypageseo/workspace";

/** Plan limits for the current organization. */
export function usePlan(): PlanState {
  return resolvePlan(useAccountType());
}

/** Convenience hook for a single metric the plan defines. */
export function usePlanLimit(metric: PlanMetricId): PlanLimitState | null {
  return usePlan().limitFor(metric);
}

/**
 * Plan-availability state. Deliberately distinct from the access-denied state:
 * nothing is forbidden here, the current plan simply does not include more.
 */
export function PlanLimitPanel({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-xl flex-col items-center rounded-lg border border-border bg-surface px-6 py-10 text-center shadow-card",
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-brand-tint text-primary">
        <Sparkles className="size-4.5" aria-hidden />
      </span>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" asChild>
          <Link to="/settings/billing">View plan &amp; usage</Link>
        </Button>
      </div>
    </div>
  );
}

/** Compact inline notice used above lists and forms. */
export function PlanLimitNotice({
  state,
  className,
}: {
  state: PlanLimitState;
  className?: string;
}) {
  if (!state.reached && !state.nearLimit) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm",
        className,
      )}
    >
      <Gauge className="size-4 shrink-0 text-primary" aria-hidden />
      <span className={state.reached ? "font-medium text-foreground" : "text-muted-foreground"}>
        {state.reached ? planLimitMessage(state) : planNearLimitMessage(state)}
      </span>
      <Link
        to="/settings/billing"
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        Plan &amp; usage
      </Link>
    </div>
  );
}

/**
 * Renders children while the plan still has room for the metric, and the plan
 * state when the limit has been reached.
 */
export function WithinPlanLimit({
  metric,
  children,
  fallback,
}: {
  metric: PlanMetricId;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const state = usePlanLimit(metric);
  if (!state?.reached) return <>{children}</>;
  return <>{fallback ?? null}</>;
}
