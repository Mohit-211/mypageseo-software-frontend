import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  Inbox,
  Loader2,
  PlugZap,
  RotateCw,
  SearchX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MODULE_TONE_CLASSES, STATUS_TONE_CLASSES, type ModuleTone } from "@/components/layout/shared/module-tone";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export type EmptyStateVariant = "first-use" | "no-results" | "not-connected" | "unavailable" | "all-done" | "coming-soon";

// What each kind of empty looks like when the caller doesn't choose: an icon, its colour and the box.
const VARIANT: Record<EmptyStateVariant, { icon: IconComponent; circle: string; box: string; pill?: string }> = {
  "first-use": {
    icon: Inbox,
    circle: MODULE_TONE_CLASSES.dashboard.chip,
    box: "border border-dashed border-border-strong bg-card",
  },
  "no-results": {
    icon: SearchX,
    circle: MODULE_TONE_CLASSES.settings.chip,
    box: "",
  },
  "not-connected": {
    icon: PlugZap,
    circle: `${STATUS_TONE_CLASSES.info.chip} ring-1 ring-inset ring-info/20`,
    box: "border border-dashed border-border-strong bg-card",
  },
  unavailable: {
    icon: Hourglass,
    circle: `${STATUS_TONE_CLASSES.info.chip} ring-1 ring-inset ring-info/20`,
    box: "border border-dashed border-border-strong bg-card",
    pill: "Coming online",
  },
  "all-done": {
    icon: CheckCircle2,
    circle: `${STATUS_TONE_CLASSES.success.chip} ring-1 ring-inset ring-success/20`,
    box: "border border-border bg-card",
  },
  "coming-soon": {
    icon: Clock,
    circle: MODULE_TONE_CLASSES.brand.chip,
    box: "border border-dashed border-border-strong bg-card",
    pill: "Coming soon",
  },
};

/** A soft pill over an empty state's title ("Coming soon", "Coming online"); violet for AI. */
function StatePill({ label, ai }: { label: string; ai: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        ai ? "border-ai/25 bg-ai-surface text-ai" : "border-primary/20 bg-brand-tint text-primary",
      )}
    >
      <Clock className="size-3.5" aria-hidden /> {label}
    </span>
  );
}

/**
 * Shared empty state: there is nothing to show here yet, and this is the next step.
 * - `first-use` (default): explains the value and offers the first action.
 * - `no-results`: filters or a search matched nothing; compact, borderless, offer "Clear filters".
 * - `not-connected`: a data source (Google) isn't connected yet.
 * - `unavailable`: temporarily not available (AI switching on, waiting for Google); no action needed.
 * - `all-done`: everything is handled ("All caught up").
 * - `coming-soon`: planned, not built yet.
 * Never use this for failures (see ErrorState / SectionError).
 */
export function EmptyState({
  title,
  description,
  icon,
  tone,
  variant = "first-use",
  action,
  secondaryAction,
  compact = false,
  className,
}: {
  title: string;
  description: ReactNode;
  /** Lucide icon shown in a tinted circle (each variant has a default). */
  icon?: IconComponent;
  /** Module colour for the icon circle, e.g. "keywords" or "ai" (each variant has a default). */
  tone?: ModuleTone;
  variant?: EmptyStateVariant;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const look = VARIANT[variant];
  const Icon = icon ?? look.icon;
  const dense = compact || variant === "no-results";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl px-6 text-center",
        look.box,
        dense ? "py-8" : "py-12",
        className,
      )}
    >
      <span aria-hidden className={cn("rounded-full bg-muted/70 p-1.5", dense && "p-1")}>
        <span
          className={cn(
            "grid place-items-center rounded-full",
            dense ? "size-10" : "size-12",
            tone ? MODULE_TONE_CLASSES[tone].chip : look.circle,
          )}
        >
          <Icon className={dense ? "size-5" : "size-6"} aria-hidden />
        </span>
      </span>
      {look.pill ? (
        <div className="mt-4">
          <StatePill label={look.pill} ai={tone === "ai"} />
        </div>
      ) : null}
      <h3 className={cn("text-base font-semibold text-foreground", look.pill ? "mt-2" : dense ? "mt-3" : "mt-4")}>{title}</h3>
      <div className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</div>
      {action || secondaryAction ? (
        <div className={cn("flex flex-wrap items-center justify-center gap-2", dense ? "mt-4" : "mt-5")}>
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

/** Shared error state with retry: something failed to load, and here is how to try again. */
export function ErrorState({
  title = "This data could not be loaded",
  description,
  onRetry,
  retryLabel = "Try again",
  action,
  compact = false,
  className,
}: {
  title?: string;
  description: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-critical/25 bg-card px-6 text-center shadow-card",
        compact ? "py-8" : "py-10",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid place-items-center rounded-full ring-1 ring-inset ring-critical/20",
          STATUS_TONE_CLASSES.critical.chip,
          compact ? "size-10" : "size-12",
        )}
      >
        <AlertTriangle className={compact ? "size-5" : "size-6"} aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <div className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</div>
      {onRetry || action ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCw aria-hidden /> {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading placeholders                                                        */
/* -------------------------------------------------------------------------- */

/** Metric band skeleton: the same bordered band, cells and dividers as a row of MetricCards. */
export function MetricSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading summary"
      className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card shadow-card sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-border"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-b border-border bg-card p-4 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0">
          <Skeleton className="h-3.5 w-24" />
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
    <div role="status" aria-label="Loading table" className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex gap-4 border-b border-border-strong bg-surface-strong px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3 flex-1", i === 0 && "flex-[1.6]")} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3.5 flex-1", c === 0 && "flex-[1.6]")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Chart placeholder. Matches the height of the chart it replaces. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading chart" className={cn("rounded-xl border border-border bg-card p-4 shadow-card", className)}>
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="mt-4 h-56 w-full rounded-lg" />
    </div>
  );
}

/** Filter/toolbar placeholder shown above loading tables and charts. */
export function FilterBarSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div role="status" aria-label="Loading filters" className="grid gap-3 rounded-xl border border-border bg-card p-3 shadow-card sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-2 h-3 w-20" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Stacked card/list placeholder for panels and detail sections. */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading list" className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-card", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic section placeholder for panels without a specific shape. */
export function SectionSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading section" className={cn("rounded-xl border border-border bg-card p-4 shadow-card", className)}>
      <Skeleton className="h-3.5 w-28" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("mt-3 h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/**
 * Page-level placeholder: the page header area, a metric band and a table, so the layout doesn't
 * jump when the page arrives. The header placeholder hides itself when the page already shows its
 * real PageHeader above (see styles.css); pass `header={false}` to drop it explicitly.
 */
export function PageSkeleton({
  metrics = 4,
  rows = 6,
  columns = 5,
  header = true,
}: {
  metrics?: number;
  rows?: number;
  columns?: number;
  header?: boolean;
}) {
  return (
    <div data-page-skeleton role="status" aria-live="polite" aria-label="Loading page" className="space-y-6">
      {header ? (
        <div data-skeleton-header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <Skeleton className="hidden size-10 shrink-0 rounded-xl sm:block" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="mt-2.5 h-7 w-56 max-w-full" />
              <Skeleton className="mt-2.5 h-3.5 w-96 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      ) : null}
      {metrics > 0 ? <MetricSkeletonGrid count={metrics} /> : null}
      {rows > 0 ? <TableSkeleton rows={rows} columns={columns} /> : null}
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
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-10 text-center shadow-card",
        className,
      )}
    >
      <span aria-hidden className={cn("grid size-12 place-items-center rounded-full", MODULE_TONE_CLASSES.dashboard.chip)}>
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <div className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Inline "working on it" indicator for buttons, rows and toolbars. */
export function ActionProgress({ label = "Working…", className }: { label?: string; className?: string }) {
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}
    >
      <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
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
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-success/30 bg-success-surface px-4 py-3",
        className,
      )}
    >
      <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
      <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{message}</p>
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
} from "@/components/layout/shared/feedback/failure-states";
