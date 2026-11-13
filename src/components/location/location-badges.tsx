import { AlertTriangle, CheckCircle2, ListTodo, MapPin, Unlink, type LucideIcon } from "lucide-react";
import type { LocationStatus } from "@/api";
import { TrendIndicator } from "@/components/layout/shared/data-display";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { HEALTH_TONE_CLASSES, healthTone } from "@/lib/health-tone";
import { locationInitials } from "@/lib/locations/initials";
import { locationStatusMeta } from "@/lib/locations/location-status";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<LocationStatus, LucideIcon> = {
  active: CheckCircle2,
  setup_required: ListTodo,
  gbp_not_connected: MapPin,
  gbp_disconnected: Unlink,
  reconnect_required: AlertTriangle,
};

/** A location's status as a soft badge with an icon (the same words everywhere). */
export function LocationStatusBadge({ status, size = "md", className }: { status: LocationStatus; size?: "sm" | "md"; className?: string }) {
  const meta = locationStatusMeta(status);
  return (
    <StatusBadge tone={meta.tone} icon={STATUS_ICON[status]} size={size} className={className}>
      {meta.label}
    </StatusBadge>
  );
}

const AVATAR_SIZES = {
  sm: "size-8 rounded-lg text-xs",
  md: "size-10 rounded-xl text-sm",
  lg: "size-14 rounded-2xl text-lg",
} as const;

/** The location's initials on a brand tile (the same mark as in the sidebar's location switcher). */
export function LocationAvatar({ name, size = "sm", className }: { name: string; size?: keyof typeof AVATAR_SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center bg-linear-to-br from-primary to-brand font-bold tracking-wide text-primary-foreground shadow-xs",
        AVATAR_SIZES[size],
        className,
      )}
    >
      {locationInitials(name)}
    </span>
  );
}

/**
 * An average Google Maps rank with its change on one line ("16.9 ↗ 0.9"). `change` is
 * previous − current, so positive means the location moved up. "No data" stays muted.
 */
export function RankFigure({ text, change, className }: { text: string; change: number | null | undefined; className?: string }) {
  const muted = text === "No data" || text === "—";
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 whitespace-nowrap", className)}>
      <span className={cn("text-sm font-semibold tabular-nums", muted ? "text-muted-foreground" : "text-foreground")}>{text}</span>
      {change !== null && change !== undefined && Number(change.toFixed(1)) !== 0 ? (
        <TrendIndicator direction={change > 0 ? "up" : "down"} value={Math.abs(change).toFixed(1)} positive={change > 0} />
      ) : null}
    </span>
  );
}

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A 0–100 score in a table cell: a tiny ring in the score's health colour, the number and the
 * grade. "—" before there's a score.
 */
export function ScoreChip({ score, grade, label, className }: { score: number | null | undefined; grade?: string | null; label: string; className?: string }) {
  if (score === null || score === undefined) return <span className={cn("text-sm text-muted-foreground", className)}>—</span>;
  const ratio = Math.min(Math.max(score / 100, 0), 1);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)} title={`${label}: ${Math.round(score)} out of 100${grade ? `, grade ${grade}` : ""}`}>
      <svg viewBox="0 0 18 18" className="size-[18px] shrink-0 -rotate-90" aria-hidden>
        <circle cx="9" cy="9" r={RADIUS} fill="none" strokeWidth="2.5" className="stroke-muted" />
        <circle
          cx="9"
          cy="9"
          r={RADIUS}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          className={HEALTH_TONE_CLASSES[healthTone(score)].stroke}
        />
      </svg>
      <span className="font-semibold tabular-nums text-foreground">{Math.round(score)}</span>
      {grade ? <span className="text-xs font-medium text-muted-foreground">{grade}</span> : null}
      <span className="sr-only">out of 100</span>
    </span>
  );
}
