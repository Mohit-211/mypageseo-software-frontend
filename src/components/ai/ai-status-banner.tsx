/**
 * `AiStatusBanner`: tells people, calmly, why AI can't run right now, so AI features stay visible
 * instead of vanishing. Pass `useAiStatus(locationId)`.
 *
 * - `off` → "AI is almost ready" (never "the server"): manual writing keeps working.
 * - `paused` → "AI is paused for today" with the local time it comes back.
 * - a client_user → "Your agency runs AI for this account".
 * - Renders nothing when AI is ready, still checking, unknown, or when the account is read-only or
 *   suspended (the shell's account banner already explains that).
 *
 * The violet AI surface keeps it recognisable as AI, not as an error. `compact` is a single line
 * for cards, dialogs and editor panels; `action` adds a button on the right (e.g. "Write it yourself");
 * `detail` swaps the generic sentence for one about the feature in that spot.
 */
import type { ReactNode } from "react";
import { Hourglass, Sparkles, Users, type LucideIcon } from "lucide-react";
import { aiStatusCopy, type AiStatus, type AiStatusCopy } from "@/lib/ai/ai-status";
import { cn } from "@/lib/utils";

export type AiStatusBannerProps = {
  status: Pick<AiStatus, "state" | "blockedBy" | "resumesAt">;
  /** One line, for cards, dialogs and editor panels. */
  compact?: boolean;
  /** A button or link shown on the right (full banner) or after the text (compact). */
  action?: ReactNode;
  /**
   * Replaces the standard second sentence for this spot when AI is off or paused (not for a
   * client user's "your agency runs AI" note), e.g. "Keyword ideas switch on with it; type your
   * keywords for now." Compact banners show it after the title, full banners as the description.
   */
  detail?: string;
  className?: string;
};

const ICON: Record<AiStatusCopy["kind"], LucideIcon> = { off: Sparkles, paused: Hourglass, role: Users };

export function AiStatusBanner({ status, compact = false, action, detail, className }: AiStatusBannerProps) {
  const copy = aiStatusCopy(status);
  if (!copy) return null;
  const Icon = ICON[copy.kind];
  // A spot-specific sentence never replaces the client user's note, which names who runs AI.
  const extra = detail && copy.kind !== "role" ? detail : null;

  if (compact) {
    return (
      <div
        role="status"
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-ai/20 bg-ai-surface px-3 py-2 text-sm text-foreground",
          "motion-safe:animate-in motion-safe:fade-in-0",
          className,
        )}
      >
        <Icon aria-hidden className="size-4 shrink-0 text-ai" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{copy.title}.</span> <span className="text-muted-foreground">{extra ?? copy.short}</span>
        </p>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    );
  }

  return (
    <section
      role="status"
      className={cn(
        "relative isolate overflow-hidden rounded-xl border border-ai/20 bg-ai-surface p-4 shadow-card sm:p-5",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
        className,
      )}
    >
      {/* Decorative glow: AI's colour without shouting. */}
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-24 -z-10 size-56 rounded-full bg-ai/10 blur-3xl" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-ai to-ai-hover text-ai-foreground shadow-xs">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-[15px] font-semibold leading-6 text-foreground">{copy.title}</p>
            <p className="max-w-3xl text-sm text-muted-foreground">{extra ?? copy.description}</p>
          </div>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{action}</div> : null}
      </div>
    </section>
  );
}
