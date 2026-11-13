/**
 * `AiCostChip`: what an AI action costs, as a small pill ("1 token", "3 tokens", "Free"). Put it next
 * to or inside every AI button so nobody spends tokens by surprise.
 *
 * - `tokens`: a known price, or `item`: an `AiCostItemId` resolved with `useAiCosts(locationId)`
 *   (billing, then the location's reviews summary, then the defaults).
 * - `balance`: when it is lower than the price the chip turns amber and says so to screen readers.
 * - `variant="inverse"`: for use inside a solid button (`Button variant="ai"` or the primary teal).
 * - Free items show a green "Free".
 */
import { Coins } from "lucide-react";
import { formatTokenCount, formatTokens, useAiCosts, type AiCostItemId } from "@/lib/ai/ai-costs";
import { cn } from "@/lib/utils";

type ChipStyle = {
  /** The user's token balance; the chip warns when it is below the price. */
  balance?: number;
  variant?: "soft" | "inverse";
  className?: string;
};

export type AiCostChipProps = ChipStyle &
  ({ tokens: number; item?: never; locationId?: never } | { item: AiCostItemId; tokens?: never; locationId?: string | null });

export function AiCostChip(props: AiCostChipProps) {
  if (props.item !== undefined) {
    return <ItemCostChip item={props.item} locationId={props.locationId} balance={props.balance} variant={props.variant} className={props.className} />;
  }
  return <CostPill tokens={props.tokens} balance={props.balance} variant={props.variant} className={props.className} />;
}

function ItemCostChip({ item, locationId, ...style }: ChipStyle & { item: AiCostItemId; locationId?: string | null }) {
  const costs = useAiCosts(locationId);
  return <CostPill tokens={costs[item]} {...style} />;
}

function CostPill({ tokens, balance, variant = "soft", className }: ChipStyle & { tokens: number }) {
  const free = tokens <= 0;
  const short = !free && balance !== undefined && balance < tokens;
  const have = formatTokenCount(balance ?? 0);
  const tone =
    variant === "inverse"
      ? "border-white/30 bg-white/15 text-current"
      : short
        ? "border-warning/35 bg-warning-surface text-warning-foreground"
        : free
          ? "border-success/25 bg-success-surface text-success"
          : "border-ai/20 bg-ai-surface text-ai";
  return (
    <span
      title={short ? `You have ${have}` : undefined}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-xs font-medium leading-5 tabular-nums",
        tone,
        className,
      )}
    >
      {free ? null : <Coins aria-hidden className="size-3.5 shrink-0" />}
      {free ? null : <span className="sr-only">Costs </span>}
      {formatTokens(tokens)}
      {short ? <span className="sr-only">; you have {have}</span> : null}
    </span>
  );
}
