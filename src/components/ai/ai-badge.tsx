/**
 * `AiBadge`: the violet "AI" pill with a Sparkles glyph. It marks anything AI made or does (AI drafts,
 * AI posts and images, AI nav entries, AI feature cards), so AI is recognisable at a glance.
 *
 * - `variant="solid"` (default): violet fill, white text (6.2:1). For headings, nav and cards.
 * - `variant="soft"`: violet tint, violet text (5.5:1). For dense lists and table rows.
 * - `label` defaults to "AI" (an uppercase 11px micro-badge, the one place 11px is allowed); any other
 *   label ("AI draft", "AI image") renders at 12px in sentence case.
 */
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type AiBadgeProps = {
  label?: string;
  variant?: "solid" | "soft";
  className?: string;
  /** Native tooltip, e.g. "Written with AI". */
  title?: string;
};

export function AiBadge({ label = "AI", variant = "solid", className, title }: AiBadgeProps) {
  const micro = label === "AI";
  return (
    <span
      title={title}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px leading-5",
        micro ? "text-[11px] font-semibold uppercase tracking-wide" : "text-xs font-medium",
        variant === "solid" ? "border-transparent bg-ai text-ai-foreground shadow-xs" : "border-ai/25 bg-ai-surface text-ai",
        className,
      )}
    >
      <Sparkles aria-hidden className="size-3 shrink-0" strokeWidth={2.25} />
      {label}
    </span>
  );
}
