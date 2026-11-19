import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatShortDate } from "@/lib/datetime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Coins, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { checkoutTokens, getBillingSummary, getTokenLedger, getTokenPacks, isApiError, type TokenLedgerEntry } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAccess } from "@/hooks/use-access";
import { AI_COST_ITEMS, formatBlockPrice, resolveAiCosts, type AiCostItemId } from "@/lib/ai/ai-costs";
import { useOptionalLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath, pickNavLocationId } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { cn, formatMoney } from "@/lib/utils";

const TOP_UP_TYPES: TokenLedgerEntry["type"][] = ["purchase", "grant", "monthly_grant"];

const TOKEN_BALANCE_QUERY_KEY = ["billing", "tokens"] as const;
/** Everything that shows a balance (this pill, the billing summary behind AI Studio and AI costs, the ledger). */
const BILLING_QUERY_PREFIX = ["billing"] as const;

/**
 * The AI prices worth a line in the popover, in the shared list's order and words (`AI_COST_ITEMS`; the full list
 * is on AI Studio). Review replies read "1 token = 10 replies", from the plan's price and block size.
 */
const POPOVER_AI_ITEMS: readonly AiCostItemId[] = ["post_draft", "post_image", "reply_drafts_per_10", "insights", "keyword_suggestions"];
const AI_ROWS = AI_COST_ITEMS.filter((item) => POPOVER_AI_ITEMS.includes(item.id));

/** Balance plus the last top-up, so the bar can show how much of it is left. */
function useTokenBalance(enabled: boolean) {
  return useQuery({
    queryKey: TOKEN_BALANCE_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const [billing, ledger] = await Promise.all([
        getBillingSummary(signal),
        getTokenLedger(50, signal).catch(() => null),
      ]);
      const lastTopUp = ledger?.entries.find((entry) => TOP_UP_TYPES.includes(entry.type)) ?? null;
      return {
        balance: billing.tokens.balance,
        cost: billing.tokens.cost_per_refresh,
        aiCosts: billing.tokens.ai_costs ?? {},
        blockSize: billing.tokens.ai_credits?.block_size,
        lastTopUp,
        monthlyGrant: billing.tokens.monthly_grant ?? 0,
        nextGrantAt: billing.tokens.next_grant_at ?? null,
      };
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

const tokensLabel = (count: number) => `${count} token${count === 1 ? "" : "s"}`;

/**
 * Token balance in the header: manual refreshes and AI actions spend tokens. The popover compares
 * the balance with the last top-up (or this month's grant), lists what tokens pay for, and
 * "Buy tokens" opens the token packs (owners only; members are told to ask the owner).
 */
export function TokenBalance() {
  const { organization, status, locations, activeLocation } = useWorkspace();
  const route = useOptionalLocationRoute();
  // Checkout is owner-only (`POST billing/tokens/checkout`), so members never see the packs.
  const canBuy = useAccess().can("billing.manage");
  // Billing is readable by owners and members; a client user gets 403 and sees nothing here.
  const enabled = Boolean(organization) && organization?.role !== "client_user";
  const balance = useTokenBalance(enabled);
  const [open, setOpen] = useState(false);
  const [buying, setBuying] = useState(false);

  // Same footprint as the pill while the account or the balance loads, so the header doesn't shift.
  const placeholder = <span aria-hidden className="h-9 w-[4.75rem] shrink-0 rounded-full bg-muted motion-safe:animate-pulse sm:w-[7.25rem]" />;
  if (!organization && status === "loading") return placeholder;
  if (!enabled) return null;
  if (balance.isPending) return placeholder;
  if (!balance.data) return null;
  const { balance: tokens, cost, aiCosts, blockSize, lastTopUp, monthlyGrant, nextGrantAt } = balance.data;
  // With a monthly grant the bar is "of this month's grant"; otherwise it compares with the last
  // top-up (or the balance itself when it is higher, e.g. after several top-ups).
  const scale = monthlyGrant > 0 ? Math.max(monthlyGrant, tokens) : Math.max(tokens, lastTopUp?.balance_after ?? 0, 1);
  const share = Math.min(1, tokens / scale);
  const low = tokens < Math.max(cost.rankings, 1) * 2;
  const refreshes = cost.rankings > 0 ? Math.floor(tokens / cost.rankings) : null;
  // The plan's AI prices from the same billing answer (missing keys fall back to the defaults).
  const prices = resolveAiCosts(aiCosts);
  // The full price list lives on AI Studio, which belongs to a location.
  const pricesLocationId = pickNavLocationId({
    routeLocationId: route?.location.location_id,
    activeLocationId: activeLocation?.id,
    locationIds: locations.map((location) => location.id),
  });

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${tokensLabel(tokens)} left${low ? ", running low" : ""}`}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full border pl-1 pr-3 text-sm font-semibold tabular-nums shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              low
                ? "border-warning/50 bg-warning-surface text-warning-foreground hover:border-warning"
                : "border-border bg-card text-foreground hover:border-border-strong hover:bg-accent data-[state=open]:bg-accent",
            )}
          >
            <span aria-hidden className="grid size-7 place-items-center rounded-full bg-warning-surface text-warning-foreground ring-1 ring-inset ring-warning/30">
              <Coins className="size-4" />
            </span>
            {tokens}
            <span className="hidden font-normal text-muted-foreground sm:inline">tokens</span>
          </button>
        </PopoverTrigger>
        {/* collisionPadding keeps the page gutter on phones instead of touching the screen edge. */}
        <PopoverContent align="end" sideOffset={8} collisionPadding={16} className="w-[calc(100vw-2rem)] max-w-80 p-0">
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-warning-surface text-warning-foreground ring-1 ring-inset ring-warning/30">
                <Coins className="size-5" />
              </span>
              <div>
                <p className="text-lg font-semibold leading-tight tabular-nums text-foreground">{tokensLabel(tokens)}</p>
                <p className="text-xs text-muted-foreground">Tokens pay for manual refreshes and AI actions.</p>
              </div>
            </div>
            <div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={scale}
                aria-valuenow={tokens}
                aria-label="Tokens left"
              >
                <div className={cn("h-full rounded-full", low ? "bg-warning" : "bg-primary")} style={{ width: `${share * 100}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {monthlyGrant > 0
                  ? `${tokens} of ${monthlyGrant} this month${nextGrantAt ? ` · ${monthlyGrant} more on ${formatShortDate(nextGrantAt)}` : ""}`
                  : lastTopUp
                    ? `${tokens} of ${scale} since your last top-up`
                    : "No top-ups yet"}
                {refreshes !== null ? ` · enough for ${refreshes} rankings refresh${refreshes === 1 ? "" : "es"}` : ""}
              </p>
            </div>
          </div>
          <div className="space-y-3 border-t border-border bg-surface-strong px-4 py-3">
            <CostGroup icon={RefreshCw} title="Refreshes">
              {/* The same names as the buttons that spend them and the Billing page. */}
              <CostRow label="Refresh rankings" value={tokensLabel(cost.rankings)} />
              <CostRow label="Refresh profile data" value={tokensLabel(cost.gbp)} />
              <CostRow label="Automatic monthly refresh" value="Free" />
            </CostGroup>
            <CostGroup icon={Sparkles} title="AI" ai>
              {AI_ROWS.map((item) => (
                <CostRow key={item.id} label={item.short ?? item.label} value={formatBlockPrice(item, prices, blockSize)} />
              ))}
            </CostGroup>
            {pricesLocationId ? (
              <Link
                to={locationPath(pricesLocationId, "ai", "#ai-costs")}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-8 items-center gap-1 rounded-sm text-xs font-semibold text-primary underline-offset-4 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                See every AI price <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            ) : null}
          </div>
          <div className="border-t border-border p-3">
            {canBuy ? (
              <Button
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  setBuying(true);
                }}
              >
                Buy tokens
              </Button>
            ) : (
              <p className="px-1 text-xs text-muted-foreground">Need more? Ask the account owner to add tokens.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {buying ? <BuyTokensDialog onClose={() => setBuying(false)} /> : null}
    </>
  );
}

function CostGroup({ icon: Icon, title, ai = false, children }: { icon: typeof Coins; title: string; ai?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", ai ? "text-ai" : "text-muted-foreground")}>
        <Icon aria-hidden className="size-3.5" />
        {title}
      </p>
      <dl className="space-y-1 text-sm">{children}</dl>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="shrink-0 font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/** Token packs and checkout (PayPal). Also opened from AI Studio's price list. */
export function BuyTokensDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const packs = useQuery({ queryKey: ["billing", "token-packs"], queryFn: ({ signal }) => getTokenPacks(signal), retry: false });
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (packId: string) => {
    setBuying(packId);
    setError(null);
    try {
      const order = await checkoutTokens(packId);
      if (order.fulfilled) {
        await queryClient.invalidateQueries({ queryKey: BILLING_QUERY_PREFIX });
        toast.success("Tokens added.");
        onClose();
        return;
      }
      // PayPal returns to the billing page, which captures the order.
      if (order.approve_url) window.location.assign(order.approve_url);
      else setError("The payment couldn't be started. Try again.");
    } catch (err) {
      const reason = isApiError(err) ? err.reason : undefined;
      setError(
        reason === "pack_not_found"
          ? "That pack isn't available any more."
          : reason === "owner_only"
            ? "Only the account owner can buy tokens."
            : isApiError(err) && err.status === 503
              ? "Online payments aren't set up yet."
              : "The payment couldn't be started. Try again.",
      );
    } finally {
      setBuying(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || buying ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buy tokens</DialogTitle>
          <DialogDescription>Tokens pay for manual refreshes and AI actions. You'll pay with PayPal and come back here.</DialogDescription>
        </DialogHeader>
        {packs.isPending ? (
          <LoaderCircle aria-label="Loading packs" className="size-5 animate-spin text-muted-foreground" />
        ) : packs.isError || !packs.data?.packs.length ? (
          <p className="text-sm text-muted-foreground">No token packs are available right now.</p>
        ) : (
          <ul className="space-y-2">
            {packs.data.packs.map((pack) => (
              <li key={pack.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{pack.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pack.tokens} tokens
                    {pack.expires_after_days ? ` · valid ${pack.expires_after_days} days` : ""}
                  </p>
                </div>
                <Button size="sm" disabled={buying !== null} onClick={() => void buy(pack.id)}>
                  {buying === pack.id ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                  {pack.price < pack.list_price ? (
                    <s className="mr-1 text-xs font-normal">{formatMoney(pack.list_price, pack.currency)}</s>
                  ) : null}
                  {formatMoney(pack.price, pack.currency)}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={buying !== null}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
