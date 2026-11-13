/**
 * `AiFeatureCard`: one AI feature on AI Studio (AI Posts, AI Review Replies, Review insights, Keyword
 * ideas, AI Visibility). A white card with a violet gradient accent, a violet icon tile, what the
 * feature does, an optional live stat, its price and a call to action.
 *
 * The whole card is one link (a stretched link: one tab stop, a large touch target), with the focus
 * ring drawn around the card. It lifts on hover; reduced motion keeps it still.
 *
 * `status` adds a pill but never hides the card or blocks the link, because the AI pages still work
 * for manual writing while AI is off:
 * - "off" → "Almost ready"; "paused" → "Paused today"; "soon" → "Soon" (a feature not built yet);
 * - "ready", "checking", "unknown" → no pill.
 *
 * `children` render above the link layer, so they may hold their own buttons (e.g. "Connect Google").
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Hourglass, Sparkles, type LucideIcon } from "lucide-react";
import type { AiCostItemId } from "@/lib/ai/ai-costs";
import type { AiState } from "@/lib/ai/ai-status";
import { cn } from "@/lib/utils";
import { AiCostChip } from "./ai-cost-chip";

export type AiFeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  /** Where the card goes. */
  to: string;
  /** The call to action, e.g. "Open AI Posts". */
  cta: string;
  /** Price chip: a token count, or an item resolved with `useAiCosts(locationId)`. */
  cost?: number | AiCostItemId;
  /** `useAiStatus().state`, or "soon" for a feature that isn't built yet. */
  status?: AiState | "soon";
  /** One line of live data, e.g. "12 reviews waiting for a reply". */
  stat?: ReactNode;
  /** Used to resolve `cost` when it's an item id. */
  locationId?: string | null;
  /** The token balance, so the price chip can warn when it isn't enough. */
  balance?: number;
  /** Extra content under the description; it sits above the link layer, so it may be interactive. */
  children?: ReactNode;
  className?: string;
};

type Pill = { label: string; icon: LucideIcon; className: string };

const PILL: Partial<Record<AiState | "soon", Pill>> = {
  off: { label: "Almost ready", icon: Sparkles, className: "border-ai/25 bg-ai-surface text-ai" },
  paused: { label: "Paused today", icon: Hourglass, className: "border-warning/35 bg-warning-surface text-warning-foreground" },
  soon: { label: "Soon", icon: Clock, className: "border-border-strong/70 bg-muted text-muted-foreground" },
};

export function AiFeatureCard({
  icon: Icon,
  title,
  description,
  to,
  cta,
  cost,
  status,
  stat,
  locationId,
  balance,
  children,
  className,
}: AiFeatureCardProps) {
  const pill = status ? PILL[status] : undefined;
  const PillIcon = pill?.icon;
  return (
    <article
      className={cn(
        "group relative isolate flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card",
        "transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-ai/35 hover:shadow-raised motion-reduce:hover:translate-y-0",
        "has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background",
        className,
      )}
    >
      {/* The violet accent: a gradient rule on top and a soft wash in the corner. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-ai via-ai/70 to-primary" />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-16 -z-10 size-44 rounded-full bg-ai/10 blur-2xl transition-colors duration-300 group-hover:bg-ai/20"
      />

      <div className="flex flex-1 flex-col gap-4 p-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-ai to-ai-hover text-ai-foreground shadow-xs ring-1 ring-inset ring-white/15"
          >
            <Icon className="size-5" />
          </span>
          {pill && PillIcon ? (
            <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-xs font-medium leading-5", pill.className)}>
              <PillIcon aria-hidden className="size-3.5 shrink-0" />
              {pill.label}
            </span>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-semibold leading-snug text-foreground">{title}</h3>
          <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
        </div>

        {stat ? (
          <p className="flex items-start gap-2 text-sm font-medium text-foreground">
            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ai" />
            <span className="min-w-0">{stat}</span>
          </p>
        ) : null}

        {children ? <div className="relative z-10 text-sm">{children}</div> : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-4">
          <Link
            to={to}
            className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-ai underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] group-hover:underline focus-visible:outline-none"
          >
            {cta}
            <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
          </Link>
          {cost !== undefined ? (
            typeof cost === "number" ? (
              <AiCostChip tokens={cost} balance={balance} />
            ) : (
              <AiCostChip item={cost} locationId={locationId} balance={balance} />
            )
          ) : null}
        </div>
      </div>
    </article>
  );
}
