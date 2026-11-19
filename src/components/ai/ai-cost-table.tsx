/**
 * `AiCostTable`: the AI price list (AI Studio's "What AI costs", and any page that wants it), one row
 * per `AI_COST_ITEMS` entry grouped by area, each with what one charge covers and its price chip.
 * Prices come from `useAiCosts()` / `useAiStatus().costs`, so they always match the plan.
 *
 * Review replies and analyses are bought in blocks per location (2026-11-17): their chip reads "1 token = 10
 * replies" (`formatBlockPrice` with `blockSize`, the summary's `credits.block_size`), as Billing and the token
 * popover say it, with `block.unit` under the name.
 *
 * `columns={2}` puts Google posts on the left and reviews plus keywords on the right (wide cards);
 * `footer` sits under the list, e.g. the balance and "Buy tokens".
 */
import type { ReactNode } from "react";
import { MessageSquareHeart, PenLine, Tags, type LucideIcon } from "lucide-react";
import { AI_COST_ITEMS, formatBlockPrice, type AiCostItem, type AiCosts } from "@/lib/ai/ai-costs";
import { cn } from "@/lib/utils";
import { AiCostChip } from "./ai-cost-chip";

const GROUPS: { id: AiCostItem["group"]; label: string; icon: LucideIcon }[] = [
  { id: "posts", label: "Google posts", icon: PenLine },
  { id: "reviews", label: "Reviews", icon: MessageSquareHeart },
  { id: "keywords", label: "Keywords", icon: Tags },
];

export type AiCostTableProps = {
  costs: AiCosts;
  /** The token balance, so prices above it are marked. */
  balance?: number;
  /** How many replies (or analyses) one block holds: `credits.block_size` (10 by default) when known. */
  blockSize?: number | undefined;
  /** 2 = groups side by side from the md breakpoint. */
  columns?: 1 | 2;
  footer?: ReactNode;
  className?: string;
};

/** A block's price, the cost chip with its words: "1 token = 10 replies" (amber, and said, when the balance is below it). */
function BlockPrice({ item, costs, blockSize, balance }: { item: AiCostItem; costs: AiCosts; blockSize?: number | undefined; balance?: number | undefined }) {
  return <AiCostChip tokens={costs[item.id]} label={formatBlockPrice(item, costs, blockSize)} {...(balance === undefined ? {} : { balance })} />;
}

function GroupTable({
  label,
  icon: Icon,
  rows,
  costs,
  balance,
  blockSize,
}: {
  label: string;
  icon: LucideIcon;
  rows: readonly AiCostItem[];
  costs: AiCosts;
  balance?: number | undefined;
  blockSize?: number | undefined;
}) {
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <caption className="pb-1.5 text-left">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon aria-hidden className="size-3.5" />
          {label}
        </span>
      </caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">AI action</th>
          <th scope="col">Price</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr key={item.id} className="group">
            <th scope="row" className="border-b border-border py-2.5 pr-3 text-left align-top font-normal group-last:border-b-0">
              <span className="block font-medium text-foreground">{item.label}</span>
              {/* A block's price names its size ("1 token = 10 replies"), so its line says the rest. */}
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.block?.unit ?? item.unit}</span>
            </th>
            <td className="border-b border-border py-2.5 text-right align-top group-last:border-b-0">
              {item.block ? (
                <BlockPrice item={item} costs={costs} blockSize={blockSize} balance={balance} />
              ) : (
                <AiCostChip tokens={costs[item.id]} {...(balance === undefined ? {} : { balance })} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AiCostTable({ costs, balance, blockSize, columns = 1, footer, className }: AiCostTableProps) {
  const tables = GROUPS.map((group) => ({ ...group, rows: AI_COST_ITEMS.filter((item) => item.group === group.id) }))
    .filter((group) => group.rows.length > 0)
    .map((group) => (
      <GroupTable key={group.id} label={group.label} icon={group.icon} rows={group.rows} costs={costs} balance={balance} blockSize={blockSize} />
    ));
  return (
    <div className={cn("min-w-0", className)}>
      {columns === 2 ? (
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          <div className="min-w-0 space-y-6">{tables.slice(0, 1)}</div>
          <div className="min-w-0 space-y-6">{tables.slice(1)}</div>
        </div>
      ) : (
        <div className="space-y-6">{tables}</div>
      )}
      {footer ? <div className="mt-4 border-t border-border pt-4">{footer}</div> : null}
    </div>
  );
}
