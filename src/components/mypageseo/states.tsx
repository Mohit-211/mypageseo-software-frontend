import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shared empty state: the entity genuinely has no records.
 * Always explains what is missing and offers the next action.
 * Never use this for failures (see SectionError) or for a data source that is
 * simply not connected (see NotConnectedState).
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  secondaryAction,
  compact = false,
  className,
}: {
  title: string;
  description: string;
  /** Optional lucide icon, rendered small and monochrome. */
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-primary/25 bg-brand-tint px-6 text-center",
        compact ? "py-8" : "py-12",
        className,
      )}
    >
      {Icon ? <Icon className="mb-3 size-5 text-primary" aria-hidden /> : null}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {action || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

/** Shared error state with retry. */
export function ErrorState({
  title = "This data could not be loaded",
  description,
  onRetry,
  retryLabel = "Retry",
  action,
  className,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border bg-critical-surface/40 px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-5 text-critical" aria-hidden />
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry || action ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCw className="size-3.5" /> {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>

  );
}

/** Metric row skeleton used while summary data loads. */
export function MetricSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-b border-border bg-surface p-4 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Table skeleton used while operational data loads. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex gap-4 border-b border-border bg-surface-strong px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border px-4 py-3 last:border-b-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Chart placeholder. Matches the height of the chart it replaces. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface p-4", className)}
      aria-label="Loading chart"
    >
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-4 h-56 w-full" />
    </div>
  );
}

/** Filter/toolbar placeholder shown above loading tables and charts. */
export function FilterBarSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-2 h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Stacked card/list placeholder for panels and detail sections. */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-border px-4 py-3.5 last:border-b-0">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Generic section placeholder for panels without a specific shape. */
export function SectionSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-4", className)}>
      <Skeleton className="h-3 w-28" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="mt-3 h-3.5 w-full" />
      ))}
    </div>
  );
}

/** Page-level placeholder: header block plus summary and table. */
export function PageSkeleton({
  metrics = 4,
  rows = 6,
  columns = 5,
}: {
  metrics?: number;
  rows?: number;
  columns?: number;
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading page">
      <MetricSkeletonGrid count={metrics} />
      <TableSkeleton rows={rows} columns={columns} />
    </div>
  );
}

/**
 * Long-running work that the product is performing (generation, scanning,
 * syncing). Distinct from a loading skeleton, which means "fetching".
 */
export function ProcessingState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border bg-surface px-6 py-10 text-center shadow-card",
        className,
      )}
    >
      <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Inline "working on it" indicator for buttons, rows and toolbars. */
export function ActionProgress({ label = "Working…", className }: { label?: string; className?: string }) {
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

/** Quiet confirmation banner after a completed action. */
export function SuccessNotice({
  message,
  action,
  className,
}: {
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-primary/25 bg-brand-tint px-4 py-2.5",
        className,
      )}
    >
      <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-foreground">{message}</p>
      {action}
    </div>
  );
}

export {
  SectionError,
  InlineError,
  NotConnectedState,
  PartialDataNotice,
  AppErrorState,
  SectionErrorBoundary,
} from "@/components/mypageseo/failure-states";
