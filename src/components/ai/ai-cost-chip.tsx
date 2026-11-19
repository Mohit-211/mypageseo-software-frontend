/**
 * `AiCostChip`: what an AI action costs, as a small pill ("1 token", "3 tokens", "Free"). Put it next
 * to or inside every AI button so nobody spends tokens by surprise.
 *
 * - `tokens`: a known price, or `item`: an `AiCostItemId` resolved with `useAiCosts(locationId)`
 *   (billing, then the location's reviews summary, then the defaults).
 * - Items bought in blocks (AI review replies and analyses) read "1 token = 10 replies" (`formatBlockPrice`, the
 *   block's size from `useAiBlockSize(locationId)`), never a bare "1 token" that reads as a price per reply. With
 *   `tokens`, pass that as `label` (the words shown instead of the token count).
 * - `balance`: when it is lower than the price the chip turns amber and says so to screen readers.
 * - `variant="inverse"`: for use inside a solid button (`Button variant="ai"` or the primary teal).
 * - Free items show a green "Free".
 */
import { Coins } from "lucide-react";
import { aiCostItem, formatBlockPrice, formatTokenCount, formatTokens, useAiBlockSize, useAiCosts, type AiCostItemId } from "@/lib/ai/ai-costs";
import { cn } from "@/lib/utils";

type ChipStyle = {
  /** The user's token balance; the chip warns when it is below the price. */
  balance?: number;
  variant?: "soft" | "inverse";
  className?: string;
};

export type AiCostChipProps = ChipStyle &
  (
    | { tokens: number; label?: string; item?: never; locationId?: never }
    | { item: AiCostItemId; tokens?: never; label?: never; locationId?: string | null }
  );

export function AiCostChip(props: AiCostChipProps) {
  if (props.item !== undefined) {
    return <ItemCostChip item={props.item} locationId={props.locationId} balance={props.balance} variant={props.variant} className={props.className} />;
  }
  return <CostPill tokens={props.tokens} label={props.label} balance={props.balance} variant={props.variant} className={props.className} />;
}

function ItemCostChip({ item, locationId, ...style }: ChipStyle & { item: AiCostItemId; locationId?: string | null }) {
  const costs = useAiCosts(locationId);
  const blockSize = useAiBlockSize(locationId);
  const entry = aiCostItem(item);
  return <CostPill tokens={costs[item]} label={entry.block ? formatBlockPrice(entry, costs, blockSize) : undefined} {...style} />;
}

function CostPill({ tokens, label, balance, variant = "soft", className }: ChipStyle & { tokens: number; label?: string }) {
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
      {free ? formatTokens(tokens) : (label ?? formatTokens(tokens))}
      {short ? <span className="sr-only">; you have {have}</span> : null}
    </span>
  );
}
