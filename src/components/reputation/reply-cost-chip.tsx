/**
 * What an AI reply (or analysis) button costs, as a small pill (2026-11-17: AI replies come in blocks of 10 per
 * location). While the location's replies left cover the click it shows how many are left ("4 left": no tokens);
 * when it needs a new block it shows the tokens ("1 token"); at a plan price of 0, "Free". The full sentence ("Uses 1
 * of your 4 AI replies left.") is its tooltip and is read out. Build the `cost` with `creditCost` from
 * `src/lib/reviews/reply-credits.ts`.
 */
import { Coins, MessageSquareReply } from "lucide-react";
import { formatTokenCount } from "@/lib/ai/ai-costs";
import type { CreditCost } from "@/lib/reviews/reply-credits";
import { cn } from "@/lib/utils";

export function ReplyCostChip({
  cost,
  balance,
  variant = "soft",
  className,
}: {
  cost: CreditCost;
  /** The token balance: the chip turns amber when the tokens needed are more. */
  balance?: number | undefined;
  /** `inverse`: inside a solid button. */
  variant?: "soft" | "inverse";
  className?: string;
}) {
  const short = cost.kind === "tokens" && balance !== undefined && balance < cost.tokens;
  const tone =
    variant === "inverse"
      ? "border-white/30 bg-white/15 text-current"
      : short
        ? "border-warning/35 bg-warning-surface text-warning-foreground"
        : cost.kind === "free"
          ? "border-success/25 bg-success-surface text-success"
          : cost.kind === "left"
            ? "border-border bg-card text-muted-foreground"
            : "border-ai/20 bg-ai-surface text-ai";
  const title = short ? `${cost.detail} You have ${formatTokenCount(balance ?? 0)}.` : cost.detail;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-xs font-medium leading-5 tabular-nums",
        tone,
        className,
      )}
    >
      {cost.kind === "tokens" ? <Coins aria-hidden className="size-3.5 shrink-0" /> : null}
      {cost.kind === "left" ? <MessageSquareReply aria-hidden className="size-3.5 shrink-0" /> : null}
      <span aria-hidden>{cost.chip}</span>
      <span className="sr-only">{title}</span>
    </span>
  );
}
