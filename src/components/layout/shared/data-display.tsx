import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page header used at the top of every product screen. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="relative flex flex-col gap-3 border-b border-border pb-4 pl-4 md:flex-row md:items-start md:justify-between">
      <span
        aria-hidden
        className="absolute left-0 top-0.5 h-8 w-1 rounded-full bg-primary"
      />
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
        {meta ? <div className="mt-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Section header inside a page. */
export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <span aria-hidden className="h-3.5 w-0.5 rounded-full bg-brand-soft" />
          {title}
        </h2>
        {description ? <p className="pl-3.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export type TrendDirection = "up" | "down" | "flat";

/**
 * Trend indicator. `positive` decides the semantic color, because in rank data
 * a decreasing position number is an improvement.
 */
export function TrendIndicator({
  direction,
  value,
  positive,
  className,
}: {
  direction: TrendDirection;
  value: string;
  positive?: boolean;
  className?: string;
}) {
  const isPositive = positive ?? direction === "up";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular",
        direction === "flat"
          ? "text-muted-foreground"
          : isPositive
            ? "text-success"
            : "text-critical",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">
        {direction === "up" ? "Up" : direction === "down" ? "Down" : "No change"}
        {": "}
      </span>
      {value}
    </span>
  );
}

/** Accent colours available to metric cards, so summary bands read as a set. */
export type MetricAccent = "brand" | "teal" | "green" | "amber" | "red" | "clay";

const metricAccentBar: Record<MetricAccent, string> = {
  brand: "bg-primary",
  teal: "bg-chart-2",
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-critical",
  clay: "bg-chart-6",
};

const metricAccentLabel: Record<MetricAccent, string> = {
  brand: "text-primary",
  teal: "text-chart-2",
  green: "text-success",
  amber: "text-warning-foreground",
  red: "text-critical",
  clay: "text-chart-6",
};

/** Compact metric summary card for dashboard and overview screens. */
export function MetricCard({
  label,
  value,
  trend,
  caption,
  accent,
}: {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  caption?: string;
  accent?: MetricAccent;
}) {
  return (
    <div className="relative border-b border-border bg-surface p-4 pt-[17px] last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0">
      {accent ? (
        <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", metricAccentBar[accent])} />
      ) : null}
      <p
        className={cn(
          "text-xs font-medium uppercase tracking-wide",
          accent ? metricAccentLabel[accent] : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular text-foreground">{value}</span>
        {trend}
      </div>
      {caption ? <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

export type StatusTone = "neutral" | "success" | "warning" | "critical" | "info" | "brand";

/** Status badge used for health, sync and issue states. */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<StatusTone, string> = {
    neutral: "bg-muted text-muted-foreground border-border",
    success: "bg-success-surface text-success border-success/25",
    warning: "bg-warning-surface text-warning-foreground border-warning/35",
    critical: "bg-critical-surface text-critical border-critical/25",
    info: "bg-info-surface text-info border-info/25",
    brand: "bg-brand-tint text-primary border-primary/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Card wrapper for charts and data panels. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border border-border bg-surface shadow-card", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg border-b border-border bg-brand-tint px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export type HealthTone = "healthy" | "attention" | "critical";

export function healthTone(score: number): HealthTone {
  if (score >= 80) return "healthy";
  if (score >= 60) return "attention";
  return "critical";
}

/** Score indicator: a labelled 0-100 bar with a semantic fill. */
export function ScoreIndicator({
  label,
  score,
  detail,
  tone,
  className,
}: {
  label: string;
  score: number;
  detail?: string;
  tone?: HealthTone;
  className?: string;
}) {
  const resolved = tone ?? healthTone(score);
  const fill =
    resolved === "healthy" ? "bg-success" : resolved === "attention" ? "bg-warning" : "bg-critical";
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium text-foreground">{label}</span>
        <span className="tabular text-sm font-semibold text-foreground">{score}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }} />
      </div>
      {detail ? <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

/** Segmented comparison-period control used on analytical screens. */
export function ComparisonControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel = "Comparison period",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-border bg-surface p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          className={cn(
            "inline-flex min-h-8 items-center rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
            option.value === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Chart container: title, description and a fixed-height plot area. */
export function ChartContainer({
  title,
  description,
  actions,
  height = 260,
  summary,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  height?: number;
  /** Plain-text description of what the chart shows, for screen readers. */
  summary?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <SectionHeader title={title} {...(description ? { description } : {})} {...(actions ? { actions } : {})} />
      {summary ? <p className="sr-only">{summary}</p> : null}
      <div style={{ height }} className="w-full" role="img" aria-label={summary ?? `${title} chart. ${description ?? ""}`.trim()}>
        {children}
      </div>
    </div>
  );
}
