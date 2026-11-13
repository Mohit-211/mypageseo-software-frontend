import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight, MapPin, type LucideIcon } from "lucide-react";
import type { LocationHeader } from "@/api";
import { cn } from "@/lib/utils";
import { HEALTH_TONE_CLASSES, healthTone, type HealthTone } from "@/lib/health-tone";
import { useOptionalLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useAccess } from "@/hooks/use-access";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { IconChip } from "@/components/layout/shared/icon-chip";
import type { ModuleTone } from "@/components/layout/shared/module-tone";

export { StatusBadge } from "@/components/layout/shared/status-badge";
export type { StatusTone } from "@/components/layout/shared/module-tone";

/* -------------------------------------------------------------------------- */
/* Page header                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Page header at the top of every product screen: an optional module icon, an eyebrow, the one
 * <h1> of the page, a one-line description and the page's actions.
 *
 * Under a location page (`/locations/:id/*`) the eyebrow automatically names the location (and its
 * client for agencies), since there is no location bar or tab bar any more. Actions sit on the
 * right and wrap below the title when the row gets tight; the title block never shrinks below
 * about 20rem. `meta` (a line of facts) runs the full width under both. `children` render as a
 * toolbar row under the header (filters, view switches).
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  icon,
  tone = "brand",
  eyebrow,
  showLocation = true,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  icon?: LucideIcon;
  tone?: ModuleTone;
  /** Extra context above the title, shown after the automatic location eyebrow. */
  eyebrow?: ReactNode;
  /** Show the current location above the title on location pages (default true). */
  showLocation?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const route = useOptionalLocationRoute();
  const location = showLocation ? (route?.location ?? null) : null;
  // The tab and history name the page and its location even where the eyebrow is hidden
  // ("Overview · Harbor Dental – Downtown · MyPageSEO").
  useDocumentTitle([title, route?.location.name]);

  return (
    <header data-page-header className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-4">
        <div className="flex min-w-0 flex-[1_1_20rem] items-start gap-3.5">
          {icon ? <IconChip icon={icon} tone={tone} size="lg" className="mt-0.5 hidden sm:grid" /> : null}
          <div className="min-w-0 flex-1">
            {location || eyebrow ? (
              <div className="mb-1 flex min-h-5 min-w-0 items-center gap-x-3 gap-y-1">
                {location ? <LocationEyebrow location={location} /> : null}
                {eyebrow ? <div className="flex shrink-0 items-center gap-2 text-xs">{eyebrow}</div> : null}
              </div>
            ) : null}
            {/* Focusable from script only: after a page change that took focus away (a link in the
                page or the mobile menu), the shell moves it here. */}
            <h1 tabIndex={-1} className="text-2xl font-semibold leading-tight tracking-tight text-foreground outline-none">
              {title}
            </h1>
            {description ? (
              typeof description === "string" ? (
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
              ) : (
                <div className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</div>
              )
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex max-w-full flex-wrap items-center gap-2 max-sm:order-2">{actions}</div> : null}
        {/* The facts line (last update, scope, status) takes the whole width under the title and the
            actions, lined up with the title, so it stays on one line instead of wrapping in the title
            column beside a row of buttons. On phones it stays with the title, above the actions.
            The negative margin turns the 16px row gap into the 10px it sits under the description. */}
        {meta ? <div className={cn("-mt-1.5 min-w-0 basis-full max-sm:order-1", icon && "sm:pl-13.5")}>{meta}</div> : null}
      </div>
      {children ? <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

/** "📍 Location name · Client" above a location page's title. One line; the client name truncates first. */
function LocationEyebrow({ location }: { location: LocationHeader }) {
  const { pathname } = useLocation();
  const canViewClients = useAccess().can("clients.view");
  const overview = locationPath(location.location_id);
  const onOverview = pathname.replace(/\/+$/, "") === overview;
  // Small print, but a 36px tall hit area: an invisible box above and below the 16px line, which
  // doesn't move the line. The name truncates in an inner span, as the link's own `overflow:
  // hidden` would clip that box.
  const linkClass =
    "relative min-w-0 rounded-sm underline-offset-2 outline-hidden after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <MapPin aria-hidden className="size-3.5 shrink-0 text-primary" />
      <span className="sr-only">Location:</span>
      {onOverview ? (
        <span className="min-w-0 truncate text-foreground">{location.name}</span>
      ) : (
        <Link to={overview} className={cn("text-foreground", linkClass)}>
          <span className="block truncate">{location.name}</span>
        </Link>
      )}
      {location.client ? (
        <>
          <span aria-hidden className="shrink-0 text-muted-foreground">
            ·
          </span>
          <span className="sr-only">Client:</span>
          {canViewClients ? (
            <Link to={`/clients/${encodeURIComponent(location.client.client_id)}`} className={cn("shrink-[3]", linkClass)}>
              <span className="block truncate">{location.client.name}</span>
            </Link>
          ) : (
            <span className="min-w-0 shrink-[3] truncate">{location.client.name}</span>
          )}
        </>
      ) : null}
    </p>
  );
}

/** Section header inside a page: an <h2>, a short description and the section's actions. */
export function SectionHeader({
  title,
  description,
  actions,
  icon,
  tone = "brand",
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  tone?: ModuleTone;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      {/* The chip sits beside the title line (centred on its 24px), not beside a long description. */}
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <IconChip icon={icon} tone={tone} size="sm" className="-mt-0.5" /> : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Trend and metrics                                                           */
/* -------------------------------------------------------------------------- */

export type TrendDirection = "up" | "down" | "flat";

/**
 * Trend indicator. `positive` decides the semantic colour, because in rank data a decreasing
 * position number is an improvement. `variant="chip"` puts it on a soft tinted pill.
 *
 * A change for the better is green; a change for the worse is amber (attention), because an
 * ordinary dip is not an alarm: red is kept for `severity="critical"`. `tone="neutral"` draws
 * either direction in the flat grey, for movement that is neither good nor bad for the user
 * (a competitor's rank). The arrow and the screen-reader text always carry the direction.
 */
export function TrendIndicator({
  direction,
  value,
  positive,
  variant = "text",
  tone = "auto",
  severity = "attention",
  className,
}: {
  direction: TrendDirection;
  value: string;
  positive?: boolean;
  variant?: "text" | "chip";
  /** "neutral" shows the change without judging it (grey either way). */
  tone?: "auto" | "neutral";
  /** How a change for the worse reads: amber "attention" (default) or red "critical" for a real alarm. */
  severity?: "attention" | "critical";
  className?: string;
}) {
  const isPositive = positive ?? direction === "up";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  const look = direction === "flat" || tone === "neutral" ? "flat" : isPositive ? "good" : severity === "critical" ? "critical" : "bad";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold tabular",
        variant === "chip" && "rounded-full px-1.5 py-0.5",
        look === "flat" && (variant === "chip" ? "bg-muted text-muted-foreground" : "text-muted-foreground"),
        look === "good" && (variant === "chip" ? "bg-success-surface text-success" : "text-success"),
        look === "bad" && (variant === "chip" ? "bg-warning-surface text-warning-foreground" : "text-warning-foreground"),
        look === "critical" && (variant === "chip" ? "bg-critical-surface text-critical" : "text-critical"),
        className,
      )}
    >
      {/* inline-block: callers sometimes pass `block`, and a block-level svg would sit on its own line. */}
      <Icon className="inline-block size-3.5 shrink-0 align-middle" aria-hidden />
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

// Each accent is a top bar only: labels stay in text colours, so they always read at >= 4.5:1.
const metricAccentBar: Record<MetricAccent, string> = {
  brand: "bg-brand",
  teal: "bg-chart-1",
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-critical",
  clay: "bg-chart-7",
};

/**
 * One cell of a metric band (the caller's grid draws the outer border and the dividers).
 * For a stand-alone, clickable tile with an icon use `KpiTile`.
 */
export function MetricCard({
  label,
  value,
  trend,
  caption,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  caption?: string;
  accent?: MetricAccent;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative min-w-0 border-b border-border bg-card px-4 pb-4 pt-[18px] last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0",
        className,
      )}
    >
      {accent ? <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px]", metricAccentBar[accent])} /> : null}
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
        {trend}
      </div>
      {caption ? <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Containers                                                                  */
/* -------------------------------------------------------------------------- */

/** Card wrapper for charts and data panels. */
export function Panel({
  title,
  description,
  actions,
  icon,
  tone = "brand",
  children,
  className,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  tone?: ModuleTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card shadow-card", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3.5">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? <IconChip icon={icon} tone={tone} size="sm" className="-mt-0.5" /> : null}
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-6 text-foreground">{title}</h2>
              {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Score indicator: a labelled 0-100 bar with a semantic fill (green, amber, red only when critical). */
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
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium text-foreground">{label}</span>
        <span className="tabular text-sm font-semibold text-foreground">{score}</span>
      </div>
      {/* The number above already says it; the bar is its picture. */}
      <div aria-hidden className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", HEALTH_TONE_CLASSES[resolved].fill)}
          style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
        />
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
      className="inline-flex h-9 items-center gap-1 rounded-lg bg-muted p-1 ring-1 ring-inset ring-border"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          className={cn(
            "inline-flex h-7 cursor-pointer items-center whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-[color,background-color,box-shadow] outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring",
            option.value === value
              ? "bg-card font-semibold text-foreground shadow-sm ring-1 ring-border-strong/60"
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
