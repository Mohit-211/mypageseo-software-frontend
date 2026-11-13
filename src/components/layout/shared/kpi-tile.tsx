import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { TrendIndicator, type TrendDirection } from "@/components/layout/shared/data-display";
import type { ModuleTone, StatusTone } from "@/components/layout/shared/module-tone";

// The label is the real link or button; its ::after covers the whole tile, so the tile is one big
// target while the footer (raised above it) can still hold its own links.
const STRETCHED =
  "outline-hidden after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background";

/**
 * A headline number on a card: module icon, label, a big value, an optional trend chip and a
 * short hint. With `to` (or `onClick`) the whole tile is the link, with a hover lift and a focus
 * ring. `loading` keeps the label and draws placeholders for the number.
 *
 * `tone` colours the icon chip by module; a tile that counts a status (Published, Needs attention)
 * passes `statusTone` instead. `visual` sits to the right of the number (a ScoreRing or Sparkline),
 * so the value slot only ever holds text.
 */
export function KpiTile({
  label,
  value,
  icon,
  tone = "brand",
  statusTone,
  trend,
  hint,
  to,
  onClick,
  footer,
  visual,
  loading = false,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: ModuleTone;
  /** Status colour for the icon chip (wins over `tone`). */
  statusTone?: StatusTone | undefined;
  trend?: { direction: TrendDirection; value: string; positive?: boolean };
  hint?: ReactNode;
  to?: string;
  onClick?: () => void;
  /** Extra line under a divider (e.g. a secondary metric). It stays clickable on a linked tile. */
  footer?: ReactNode;
  /** A small graphic beside the number (ScoreRing size "sm", Sparkline). Decorative unless labelled. */
  visual?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const detailsId = useId();
  const interactive = Boolean(to ?? onClick);
  const labelClass = "block text-left text-sm font-medium text-muted-foreground";

  return (
    <div
      aria-busy={loading || undefined}
      className={cn(
        "group relative flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-card",
        interactive &&
          "transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? <IconChip icon={icon} tone={tone} statusTone={statusTone} size="md" /> : null}
        <div className={cn("min-w-0 flex-1", icon && "pt-2")}>
          {to ? (
            <Link to={to} aria-describedby={detailsId} className={cn(labelClass, "group-hover:text-foreground", STRETCHED)}>
              {label}
            </Link>
          ) : onClick ? (
            <button
              type="button"
              onClick={onClick}
              aria-describedby={detailsId}
              className={cn(labelClass, "cursor-pointer group-hover:text-foreground", STRETCHED)}
            >
              {label}
            </button>
          ) : (
            <p className={labelClass}>{label}</p>
          )}
        </div>
        {interactive ? (
          <ArrowUpRight
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-[color,transform] group-hover:text-primary motion-safe:group-hover:-translate-y-px motion-safe:group-hover:translate-x-px",
              icon && "mt-2",
            )}
          />
        ) : null}
      </div>

      <div id={detailsId} className="mt-3 flex-1">
        {loading ? (
          <div role="status" aria-label={`Loading ${label}`}>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="mt-2.5 h-3 w-32" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[28px] font-semibold leading-none tracking-tight text-foreground">{value}</span>
                {trend ? (
                  <TrendIndicator
                    variant="chip"
                    direction={trend.direction}
                    value={trend.value}
                    {...(trend.positive === undefined ? {} : { positive: trend.positive })}
                  />
                ) : null}
              </div>
              {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
            </div>
            {visual ? <div className="shrink-0">{visual}</div> : null}
          </div>
        )}
      </div>

      {footer ? <div className="relative z-10 mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
