import { useId, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Info, Minus, Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatRank } from "./format";
import { BUCKET_TEXT, capStyle, rankBucket, type RankBucket } from "./ranks";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/** A small "i" that explains a term. A popover (not a tooltip) so it opens with a tap on phones too. */
export function Explain({ children, label = "What does this mean?", className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            className,
          )}
        >
          <Info aria-hidden className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 text-sm leading-relaxed text-foreground">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** A raised card with an optional title row. */
export function Card({
  title,
  explain,
  icon: IconComponent,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  explain?: ReactNode;
  icon?: Icon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card-3d min-w-0", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {IconComponent ? (
              <span className="bevel size-7">
                <IconComponent aria-hidden className="size-3.5" />
              </span>
            ) : null}
            {title}
            {explain ? <Explain label={`About ${title}`}>{explain}</Explain> : null}
          </h3>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-5", title ? "pt-3" : "", bodyClassName)}>{children}</div>
    </section>
  );
}

export type Tone = "good" | "bad" | "neutral";

/** A change pill. `better` says which direction is good for this metric. */
export function Delta({ value, text, better = "up", className }: { value: number | null | undefined; text?: string | null; better?: "up" | "down"; className?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const tone: Tone = value === 0 ? "neutral" : (value > 0) === (better === "up") ? "good" : "bad";
  const ArrowIcon = value === 0 ? Minus : value > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular",
        tone === "good" && "bg-success-surface text-success",
        tone === "bad" && "bg-critical-surface text-critical",
        tone === "neutral" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <ArrowIcon aria-hidden className="size-3" />
      {text ?? Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}
      <span className="sr-only">{tone === "good" ? " better" : tone === "bad" ? " worse" : " unchanged"}</span>
    </span>
  );
}

/** A headline number. With `onClick` it becomes a button that leads somewhere. */
export function Kpi({
  icon: IconComponent,
  label,
  explain,
  value,
  suffix,
  sub,
  delta,
  onClick,
  className,
}: {
  icon?: Icon;
  label: string;
  explain?: ReactNode;
  value: ReactNode;
  suffix?: ReactNode;
  sub?: ReactNode;
  delta?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        {IconComponent ? (
          <span className="bevel size-8">
            <IconComponent aria-hidden className="size-4" />
          </span>
        ) : null}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {explain ? <Explain label={`About ${label}`}>{explain}</Explain> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-3xl font-semibold tracking-tight text-foreground tabular">{value}</span>
        {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
        {delta}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </>
  );
  // The explain button can't sit inside another button, so a clickable tile is a div with a button role.
  return onClick ? (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn("card-3d card-lift cursor-pointer p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", className)}
    >
      {body}
    </div>
  ) : (
    <div className={cn("card-3d p-4", className)}>{body}</div>
  );
}

/** A 0–100 score as a dial with depth. */
export function ScoreRing({ value, label, size = 148, caption }: { value: number | null; label?: string | null; size?: number; caption?: string }) {
  const id = useId();
  const stroke = 12;
  const radius = (size - stroke) / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={value === null ? "No score" : `Score ${Math.round(value)} out of 100`}>
        <defs>
          <linearGradient id={`${id}-arc`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--primary)" }} />
            <stop offset="100%" style={{ stopColor: "var(--accent-2)" }} />
          </linearGradient>
          <radialGradient id={`${id}-disc`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" style={{ stopColor: "color-mix(in oklch, var(--primary) 8%, white)" }} />
          </radialGradient>
          <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.28" style={{ floodColor: "var(--primary)" }} />
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius - stroke / 2 - 4} fill={`url(#${id}-disc)`} filter={`url(#${id}-shadow)`} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} style={{ stroke: "color-mix(in oklch, var(--primary) 9%, var(--muted))" }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${id}-arc)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * pct} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          filter={`url(#${id}-shadow)`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tracking-tight text-foreground tabular">{value === null ? "—" : Math.round(value)}</span>
        {label ? <span className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</span> : null}
        {caption ? <span className="text-[11px] text-muted-foreground">{caption}</span> : null}
      </div>
    </div>
  );
}

/** A labelled horizontal bar (0–max). */
export function Bar({ label, value, max, display, color, highlight }: { label: ReactNode; value: number; max: number; display?: ReactNode; color?: string; highlight?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={cn("grid grid-cols-[minmax(0,2fr)_minmax(4rem,3fr)_auto] items-center gap-3 text-sm", highlight && "font-semibold")}>
      <span className="truncate text-foreground" title={typeof label === "string" ? label : undefined}>{label}</span>
      <span className="bar-track h-3 overflow-hidden rounded-full">
        <span className="bar-3d block h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(pct * 100, value > 0 ? 3 : 0)}%`, ...(color ? ({ "--bar": color } as CSSProperties) : {}) }} />
      </span>
      <span className="min-w-10 text-right tabular text-muted-foreground">{display ?? value.toLocaleString()}</span>
    </div>
  );
}

export function Stars({ rating, className }: { rating: number | null; className?: string }) {
  if (rating === null) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, rating - (n - 1)));
        return (
          <span key={n} className="relative inline-block size-4" aria-hidden>
            <Star className="absolute inset-0 size-4 text-border" fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="size-4 text-amber-400 drop-shadow-[0_1px_1px_rgb(180_83_9/0.35)]" fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function Pill({ tone = "neutral", children, className }: { tone?: "good" | "warn" | "bad" | "neutral" | "brand"; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        tone === "good" && "border-success/25 bg-success-surface text-success",
        tone === "warn" && "border-warning/35 bg-warning-surface text-warning-foreground",
        tone === "bad" && "border-critical/25 bg-critical-surface text-critical",
        tone === "neutral" && "border-border bg-muted text-muted-foreground",
        tone === "brand" && "border-primary/20 bg-brand-tint text-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A section that has no data in this update. */
export function NotAvailable({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border bg-surface-strong/60 px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

// ---- Ranks ----

/** A rank as a small key cap. */
export function RankCap({ rank, status = "ok", className }: { rank: number | null; status?: "ok" | "not_found" | "error"; className?: string }) {
  const bucket = rankBucket(rank, status);
  return (
    <span className={cn("keycap inline-flex min-w-10 items-center justify-center px-2 py-1 text-xs font-bold tabular", className)} style={capStyle(bucket)} title={BUCKET_TEXT[bucket]}>
      {bucket === "error" ? "–" : bucket === "not_found" ? "60+" : formatRank(rank)}
    </span>
  );
}

export function BucketLegend() {
  const buckets: RankBucket[] = ["pack", "visible", "low", "invisible", "not_found"];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Colour key">
      {buckets.map((bucket) => (
        <li key={bucket} className="flex items-center gap-1.5">
          <span aria-hidden className="keycap inline-block size-3.5 rounded-[4px]" style={capStyle(bucket)} />
          {BUCKET_TEXT[bucket]}
        </li>
      ))}
    </ul>
  );
}
