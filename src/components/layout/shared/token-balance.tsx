import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, LoaderCircle } from "lucide-react";
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
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";

const TOP_UP_TYPES: TokenLedgerEntry["type"][] = ["purchase", "grant", "monthly_grant"];

const TOKEN_BALANCE_QUERY_KEY = ["billing", "tokens"] as const;

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

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Token balance in the header: manual refreshes spend tokens. A bar compares the
 * balance with the last top-up; "Buy tokens" opens the token packs.
 */
export function TokenBalance() {
  const { organization } = useWorkspace();
  // Billing is readable by owners and members; a client user gets 403 and sees nothing here.
  const enabled = Boolean(organization) && organization?.role !== "client_user";
  const balance = useTokenBalance(enabled);
  const [buying, setBuying] = useState(false);

  if (!enabled || !balance.data) return null;
  const { balance: tokens, cost, lastTopUp, monthlyGrant, nextGrantAt } = balance.data;
  // With a monthly grant the bar is "of this month's grant"; otherwise it compares with the last
  // top-up (or the balance itself when it is higher, e.g. after several top-ups).
  const scale = monthlyGrant > 0 ? Math.max(monthlyGrant, tokens) : Math.max(tokens, lastTopUp?.balance_after ?? 0, 1);
  const share = Math.min(1, tokens / scale);
  const low = tokens < Math.max(cost.rankings, 1) * 2;
  const refreshes = cost.rankings > 0 ? Math.floor(tokens / cost.rankings) : null;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium tabular hover:bg-secondary",
              low ? "border-warning/50 text-warning-foreground" : "border-border text-foreground",
            )}
            aria-label={`${tokens} tokens left`}
          >
            <Coins aria-hidden className="size-4 text-brand-soft" />
            {tokens}
            <span className="hidden text-xs font-normal text-muted-foreground sm:inline">tokens</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{tokens} token{tokens === 1 ? "" : "s"} left</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={scale} aria-valuenow={tokens} aria-label="Tokens left">
              <div className={cn("h-full rounded-full", low ? "bg-warning" : "bg-primary")} style={{ width: `${share * 100}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {monthlyGrant > 0
                ? `${tokens} of ${monthlyGrant} this month${nextGrantAt ? ` · ${monthlyGrant} more on ${new Date(nextGrantAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}`
                : lastTopUp
                  ? `${tokens} of ${scale} since your last top-up`
                  : "No top-ups yet"}
            </p>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>Manual rankings refresh: {cost.rankings} token{cost.rankings === 1 ? "" : "s"}{refreshes !== null ? ` (enough for ${refreshes})` : ""}</li>
            <li>Manual GBP refresh: {cost.gbp} token{cost.gbp === 1 ? "" : "s"}</li>
            <li>The automatic monthly refresh is free.</li>
          </ul>
          <Button size="sm" className="w-full" onClick={() => setBuying(true)}>Buy tokens</Button>
        </PopoverContent>
      </Popover>
      {buying ? <BuyTokensDialog onClose={() => setBuying(false)} /> : null}
    </>
  );
}

function BuyTokensDialog({ onClose }: { onClose: () => void }) {
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
        await queryClient.invalidateQueries({ queryKey: TOKEN_BALANCE_QUERY_KEY });
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
          <DialogDescription>Tokens pay for manual refreshes. You'll pay with PayPal and come back here.</DialogDescription>
        </DialogHeader>
        {packs.isPending ? (
          <LoaderCircle aria-label="Loading packs" className="size-5 animate-spin text-muted-foreground" />
        ) : packs.isError || !packs.data?.packs.length ? (
          <p className="text-sm text-muted-foreground">No token packs are available right now.</p>
        ) : (
          <ul className="space-y-2">
            {packs.data.packs.map((pack) => (
              <li key={pack.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{pack.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pack.tokens} tokens
                    {pack.expires_after_days ? ` · valid ${pack.expires_after_days} days` : ""}
                  </p>
                </div>
                <Button size="sm" disabled={buying !== null} onClick={() => void buy(pack.id)}>
                  {buying === pack.id ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                  {pack.price < pack.list_price ? <s className="mr-1 text-xs opacity-70">{formatMoney(pack.list_price, pack.currency)}</s> : null}
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
