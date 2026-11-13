import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Coins,
  CreditCard,
  Download,
  FileText,
  Info,
  LoaderCircle,
  MapPin,
  MapPinPlus,
  ReceiptText,
  RefreshCw,
  Tag,
  UserRound,
} from "lucide-react";
import {
  apiErrorData,
  buyLocationSlots,
  cancelSubscription,
  checkoutSubscription,
  checkoutTokens,
  downloadInvoicePdf,
  getInvoices,
  getLocationSlotQuote,
  getTokenLedger,
  getTokenPacks,
  isApiError,
  updateBillingDetails,
  validateCoupon,
  type BillingDetails,
  type BillingInvoice,
  type BillingSummary,
  type CouponQuote,
  type TokenLedgerEntry,
} from "@/api";
import { AiBadge } from "@/components/ai/ai-badge";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { TableBody, TableHead, TablePagination, TableRow, TableScroll, Th, tdClass, tdMutedClass, tdNumberClass } from "@/components/layout/shared/data-table";
import { ConfirmDialog, FormGrid, FormSaveBar, FormTextField } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState, ListSkeleton, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import type { StatusTone } from "@/components/layout/shared/module-tone";
import { PaypalReturnNotice } from "@/components/settings/paypal-return-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccess } from "@/hooks/use-access";
import { AI_COST_ITEMS, formatTokens, useAiCosts } from "@/lib/ai/ai-costs";
import { useBilling } from "@/lib/billing/use-billing";
import { formatDate } from "@/lib/datetime";
import { cn, formatMoney, saveBlob } from "@/lib/utils";

const STATE_LABEL: Record<BillingSummary["state"], { label: string; tone: StatusTone }> = {
  trialing: { label: "Free trial", tone: "info" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Payment failed", tone: "warning" },
  // Amber like the account banner and the notice below: an attention state, not an alarm.
  inactive: { label: "Read-only", tone: "warning" },
  suspended_by_admin: { label: "Suspended", tone: "critical" },
};

const CHECKOUT_ERRORS: Record<string, string> = {
  price_not_set: "Billing opens soon: prices haven't been set yet.",
  already_subscribed: "This organization already has a subscription.",
  manual_billing: "This organization is billed by invoice. Contact us to change it.",
  enterprise_required: "More than 20 locations needs an enterprise plan. Contact us.",
  billing_not_configured: "Online payments aren't available yet.",
  no_subscription: "There's no subscription to cancel.",
  owner_only: "Only the account owner can make payments.",
};

const INVOICE_KIND: Record<BillingInvoice["kind"], string> = {
  subscription: "Subscription",
  location_slots: "Extra location",
  token_pack: "Token pack",
  manual: "Invoice",
};

const INVOICE_STATUS: Record<BillingInvoice["status"], { label: string; tone: StatusTone }> = {
  paid: { label: "Paid", tone: "success" },
  open: { label: "Open", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
  void: { label: "Void", tone: "neutral" },
};

const INVOICES_PAGE_SIZE = 12;

function checkoutError(err: unknown): string {
  if (!isApiError(err)) return "That didn't work. Try again.";
  if (err.reason === "quantity_below_active") return `You have ${String(apiErrorData(err).active ?? "more")} active locations; subscribe for at least that many.`;
  return (err.reason && CHECKOUT_ERRORS[err.reason]) ?? (err.status === 503 ? CHECKOUT_ERRORS.billing_not_configured! : "That didn't work. Try again.");
}

/** One billing page (Phase 13a): plan, tokens, invoices and details. Owners pay; members read. Gated by the settings layout. */
function SettingsBillingPage() {
  const billing = useBilling();
  const canPay = useAccess().can("billing.manage");

  return (
    <>
      <PaypalReturnNotice />
      {billing.isPending ? (
        <div role="status" aria-label="Loading billing" className="space-y-6">
          <SectionSkeleton lines={4} />
          <SectionSkeleton lines={6} />
        </div>
      ) : billing.isError ? (
        <ErrorState title="Billing couldn't be loaded" description="Check your connection and try again." onRetry={() => void billing.refetch()} />
      ) : (
        <div className="space-y-6">
          <PlanPanel billing={billing.data} canPay={canPay} />
          <TokensPanel billing={billing.data} canPay={canPay} />
          <InvoicesPanel />
          <DetailsPanel key={JSON.stringify(billing.data.billing_details ?? null)} details={billing.data.billing_details ?? null} canPay={canPay} />
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Plan                                                                        */
/* -------------------------------------------------------------------------- */

function Meter({ used, limit, label }: { used: number; limit: number; label: string }) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  return (
    <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <span className={cn("block h-full rounded-full", ratio >= 0.9 ? "bg-warning" : "bg-primary")} style={{ width: `${ratio * 100}%` }} />
    </span>
  );
}

function Notice({ tone, icon: Icon = Info, children }: { tone: "info" | "warning" | "critical"; icon?: typeof Info; children: ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm text-foreground",
        tone === "info" && "border-info/25 bg-info-surface",
        tone === "warning" && "border-warning/40 bg-warning-surface",
        tone === "critical" && "border-critical/25 bg-critical-surface",
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone === "info" ? "text-info" : tone === "warning" ? "text-warning" : "text-critical")} />
      <span>{children}</span>
    </p>
  );
}

function PlanPanel({ billing, canPay }: { billing: BillingSummary; canPay: boolean }) {
  const queryClient = useQueryClient();
  const state = STATE_LABEL[billing.state];
  const prices = billing.prices?.current ?? null;
  const subscription = billing.subscription ?? null;
  const subscribed = Boolean(subscription && subscription.status === "active" && !subscription.cancel_at_period_end);
  const active = billing.locations?.active ?? 1;
  const max = billing.locations?.max ?? billing.plan?.max_locations ?? 20;
  const [quantity, setQuantity] = useState(String(Math.max(1, active)));
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [slotQuote, setSlotQuote] = useState<Awaited<ReturnType<typeof getLocationSlotQuote>> | null>(null);
  const monthly = (n: number) => (prices ? prices.first_location + (n - 1) * prices.additional_location : null);
  const monthlyTotal = monthly(Number(quantity));

  const subscribe = async () => {
    if (busy) return;
    setBusy("subscribe");
    try {
      const result = await checkoutSubscription(Number(quantity));
      window.location.assign(result.approve_url);
    } catch (err) {
      toast.error(checkoutError(err));
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    try {
      await cancelSubscription();
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      void queryClient.invalidateQueries({ queryKey: ["organization", "usage"] });
      toast.success("Subscription cancelled. Everything keeps working until the end of the paid period.");
    } catch (err) {
      toast.error(checkoutError(err));
    } finally {
      setBusy(null);
    }
  };

  const quoteSlot = async () => {
    if (busy) return;
    setBusy("quote");
    try {
      setSlotQuote(await getLocationSlotQuote(1));
    } catch (err) {
      toast.error(checkoutError(err));
    } finally {
      setBusy(null);
    }
  };

  const buySlot = async () => {
    if (busy) return;
    setBusy("slot");
    try {
      const order = await buyLocationSlots(1);
      if (order.fulfilled) {
        void queryClient.invalidateQueries({ queryKey: ["billing"] });
        void queryClient.invalidateQueries({ queryKey: ["organization", "usage"] });
        toast.success("The extra location is available now. It's added to your next invoice.");
        setSlotQuote(null);
      } else if (order.approve_url) {
        window.location.assign(order.approve_url);
        return;
      }
    } catch (err) {
      toast.error(checkoutError(err));
    }
    setBusy(null);
  };

  return (
    <Panel
      title={billing.plan?.name ? `${billing.plan.name} plan` : "Your plan"}
      description={prices ? `${formatMoney(prices.first_location, billing.currency)} a month for the first location, ${formatMoney(prices.additional_location, billing.currency)} for each additional one. All features included.` : "Billing opens soon. Your trial keeps everything working until then."}
      icon={CreditCard}
      tone="settings"
      actions={
        <StatusBadge tone={state.tone} dot>
          {state.label}
        </StatusBadge>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <KpiTile
            label="Locations"
            icon={MapPin}
            tone="locations"
            value={`${billing.locations?.active ?? "—"} of ${billing.locations?.allowed ?? "—"}`}
            hint={
              <>
                {billing.locations ? <Meter used={billing.locations.active} limit={billing.locations.allowed} label="Locations used" /> : null}
                <span className="mt-2 block">Paid or allowed now · up to {max} on this plan</span>
              </>
            }
            className="shadow-none"
          />
          <KpiTile
            label="Users"
            // The same seat glyph as Settings › Organization (Users is the Clients icon).
            icon={UserRound}
            tone="clients"
            value={`${billing.users?.used ?? "—"} of ${billing.users?.limit ?? "—"}`}
            hint={
              <>
                {billing.users ? <Meter used={billing.users.used} limit={billing.users.limit} label="Users" /> : null}
                <span className="mt-2 block">{billing.plan?.users_per_location ?? 3} per paid location, owner included</span>
              </>
            }
            className="shadow-none"
          />
          <KpiTile
            label="Next renewal"
            icon={CalendarClock}
            tone="brand"
            value={billing.next_renewal ? formatMoney(billing.next_renewal.amount, billing.currency) : "—"}
            hint={
              billing.next_renewal
                ? `${formatDate(billing.next_renewal.date)} · ${billing.next_renewal.quantity} location${billing.next_renewal.quantity === 1 ? "" : "s"}${billing.next_renewal.fixed ? "" : " (estimate)"}`
                : "No renewal scheduled"
            }
            className="col-span-2 shadow-none sm:col-span-1"
          />
        </div>

        {billing.state === "trialing" && billing.trial_ends_at ? (
          <Notice tone="info">Your free trial ends on {formatDate(billing.trial_ends_at)}. After that the account is read-only until you subscribe.</Notice>
        ) : null}
        {billing.state === "past_due" && billing.grace_ends_at ? (
          <Notice tone="warning" icon={AlertTriangle}>
            Your last payment failed. Everything keeps working until {formatDate(billing.grace_ends_at)}; update your payment in PayPal before then.
          </Notice>
        ) : null}
        {/* Amber, like the shell's banner: read-only asks for attention; it isn't an alarm. */}
        {billing.state === "inactive" ? (
          <Notice tone="warning" icon={AlertTriangle}>
            The account is read-only: everything stays visible, but refreshes, new locations and AI actions are paused until you subscribe.
          </Notice>
        ) : null}
        {/* Members see billing but can't pay: say who can, instead of a notice with no way forward. */}
        {!canPay && (billing.state === "inactive" || billing.state === "trialing" || billing.state === "past_due") ? (
          <Notice tone="info">Only the account owner can subscribe or change the plan.</Notice>
        ) : null}
        {subscription?.cancel_at_period_end && subscription.current_period_end ? (
          <Notice tone="info">Cancelled: everything keeps working until {formatDate(subscription.current_period_end)}.</Notice>
        ) : null}
        {billing.prices?.upcoming ? (
          <Notice tone="info">
            From {formatDate(billing.prices.upcoming.effective_from)}: {formatMoney(billing.prices.upcoming.first_location, billing.currency)} for the first location and{" "}
            {formatMoney(billing.prices.upcoming.additional_location, billing.currency)} for each additional one.
          </Notice>
        ) : null}
        {!billing.online_payments ? <Notice tone="info">Online payments aren't available yet. Contact us to pay by invoice.</Notice> : null}

        {canPay && !subscribed && billing.state !== "suspended_by_admin" ? (
          <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-brand-tint/50 p-4 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="billing-quantity">Locations to pay for</Label>
              <Select value={quantity} onValueChange={setQuantity}>
                <SelectTrigger id="billing-quantity" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {Array.from({ length: max - Math.max(1, active) + 1 }, (_, index) => String(Math.max(1, active) + index)).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={busy !== null || !prices || !billing.online_payments} aria-busy={busy === "subscribe" || undefined} onClick={() => void subscribe()}>
              {busy === "subscribe" ? <LoaderCircle aria-hidden className="animate-spin" /> : <CreditCard aria-hidden />}
              Subscribe{monthlyTotal != null ? ` · ${formatMoney(monthlyTotal, billing.currency)} a month` : ""}
            </Button>
            <p className="text-xs text-muted-foreground sm:ml-2 sm:max-w-xs">You approve it with PayPal and come back here. More than {max} locations? Contact us.</p>
          </div>
        ) : null}

        {canPay && subscribed ? (
          slotQuote ? (
            <div className="max-w-md space-y-2 rounded-xl border border-border bg-surface-strong p-4 text-sm">
              <p className="font-semibold text-foreground">One more location</p>
              {(slotQuote.lines ?? []).map((line) => (
                <p key={line.label} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="tabular-nums text-foreground">{formatMoney(line.amount, slotQuote.currency)}</span>
                </p>
              ))}
              <p className="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
                <span>Total now</span>
                <span className="tabular-nums">{formatMoney(slotQuote.amount, slotQuote.currency)}</span>
              </p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={busy !== null} aria-busy={busy === "slot" || undefined} onClick={() => void buySlot()}>
                  {busy === "slot" ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Pay with PayPal
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSlotQuote(null)}>
                  Not now
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={busy !== null} aria-busy={busy === "quote" || undefined} onClick={() => void quoteSlot()}>
                {busy === "quote" ? <LoaderCircle aria-hidden className="animate-spin" /> : <MapPinPlus aria-hidden />} Add a location slot
              </Button>
              <Button size="sm" variant="ghost" className="text-critical hover:text-critical" disabled={busy !== null} onClick={() => setConfirmCancel(true)}>
                Cancel subscription
              </Button>
            </div>
          )
        ) : null}
        <p className="text-xs text-muted-foreground">Removing a location doesn't refund it: its slot stays paid and reusable until the period ends.</p>
      </div>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel the subscription?"
        description="Everything keeps working until the end of the paid period. After that the account becomes read-only."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep subscription"
        onConfirm={() => {
          setConfirmCancel(false);
          void cancel();
        }}
      />
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const LEDGER_PREVIEW = 8;

function PriceRow({ label, unit, price }: { label: string; unit?: string; price: string }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block text-sm text-foreground">{label}</span>
        {unit ? <span className="block text-xs text-muted-foreground">{unit}</span> : null}
      </span>
      <span className={cn("shrink-0 text-sm font-semibold tabular-nums", price === "Free" ? "text-success" : "text-foreground")}>{price}</span>
    </li>
  );
}

/** What each priced action costs: refreshes, then every AI action in plain words. */
function PriceList({ billing }: { billing: BillingSummary }) {
  const costs = useAiCosts();
  const refresh = billing.tokens.cost_per_refresh;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">What tokens pay for</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">The automatic monthly refresh is free.</p>
      <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <RefreshCw aria-hidden className="size-3.5" /> Refreshes
      </p>
      <ul className="divide-y divide-border">
        <PriceRow label="Refresh rankings" unit="per refresh, for one location" price={formatTokens(refresh.rankings)} />
        <PriceRow label="Refresh profile data" unit="per refresh, once a day at most" price={formatTokens(refresh.gbp)} />
      </ul>
      <p className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        AI actions <AiBadge variant="soft" />
      </p>
      <ul className="divide-y divide-border">
        {AI_COST_ITEMS.map((item) => (
          <PriceRow key={item.id} label={item.label} unit={item.unit} price={formatTokens(costs[item.id])} />
        ))}
      </ul>
    </div>
  );
}

function LedgerRow({ entry }: { entry: TokenLedgerEntry }) {
  const credit = entry.amount > 0;
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        aria-hidden
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset",
          credit ? "bg-success-surface text-success ring-success/20" : "bg-muted text-muted-foreground ring-border-strong",
        )}
      >
        {credit ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{entry.note ?? entry.type.replace(/_/g, " ")}</span>
        <span className="block text-xs text-muted-foreground">{formatDate(entry.at)}</span>
      </span>
      <span className={cn("shrink-0 text-sm font-semibold tabular-nums", credit ? "text-success" : "text-foreground")}>
        <span className="sr-only">{credit ? "Added" : "Spent"} </span>
        {credit ? "+" : "−"}
        {Math.abs(entry.amount)}
      </span>
    </li>
  );
}

function TokensPanel({ billing, canPay }: { billing: BillingSummary; canPay: boolean }) {
  const packs = useQuery({ queryKey: ["billing", "token-packs"], queryFn: ({ signal }) => getTokenPacks(signal), retry: false });
  const ledger = useQuery({ queryKey: ["billing", "ledger"], queryFn: ({ signal }) => getTokenLedger(20, signal), retry: false });
  const [coupon, setCoupon] = useState("");
  const [quotes, setQuotes] = useState<Record<string, CouponQuote>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const tokens = billing.tokens;
  const entries = ledger.data?.entries ?? [];

  const applyCoupon = async () => {
    if (!packs.data || busy) return;
    setBusy("coupon");
    const next: Record<string, CouponQuote> = {};
    let error: string | null = null;
    for (const pack of packs.data.packs) {
      try {
        next[pack.id] = await validateCoupon(pack.id, coupon.trim());
      } catch (err) {
        if (isApiError(err) && err.reason !== "coupon_not_applicable") error = err.reason ?? "invalid_coupon";
      }
    }
    setQuotes(next);
    setBusy(null);
    if (Object.keys(next).length === 0) {
      toast.error(error === "coupon_expired" ? "That coupon has expired." : error === "coupon_exhausted" ? "That coupon has been used up." : "That coupon isn't valid for these packs.");
    } else toast.success("Coupon applied. The new prices are on the packs.");
  };

  const buy = async (packId: string) => {
    if (busy) return;
    setBusy(packId);
    try {
      const order = await checkoutTokens(packId, quotes[packId] ? coupon.trim() : undefined);
      if (order.fulfilled) {
        toast.success("Tokens added.");
        window.location.reload();
      } else if (order.approve_url) window.location.assign(order.approve_url);
    } catch (err) {
      toast.error(checkoutError(err));
      setBusy(null);
    }
  };

  return (
    <section id="tokens" aria-labelledby="billing-tokens-title" className="min-w-0 scroll-mt-20 rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        {/* The chip sits on the title line (as in Panel), not beside the wrapped description. */}
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="-mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-brand-tint text-primary ring-1 ring-inset ring-primary/20">
            <Coins className="size-3.5" />
          </span>
          <div className="min-w-0">
            <h2 id="billing-tokens-title" className="text-[15px] font-semibold leading-6 text-foreground">
              Tokens
            </h2>
            <p className="text-[13px] text-muted-foreground">Manual refreshes and AI actions spend tokens. Packs never expire unless noted.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-4xl font-semibold tracking-tight text-foreground">
              {tokens.balance.toLocaleString()} <span className="text-base font-medium text-muted-foreground">tokens left</span>
            </p>
            {tokens.monthly_grant ? (
              <p className="pb-1 text-sm text-muted-foreground">
                +{tokens.monthly_grant} each month{tokens.next_grant_at ? `, next on ${formatDate(tokens.next_grant_at)}` : ""}
              </p>
            ) : null}
          </div>

          {canPay ? (
            packs.isPending ? (
              <ListSkeleton rows={2} />
            ) : packs.data?.packs.length ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Buy more</h3>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {packs.data.packs.map((pack) => {
                    const quote = quotes[pack.id];
                    const was = quote ? quote.price : pack.list_price > pack.price ? pack.list_price : null;
                    const now = quote ? quote.total : pack.price;
                    return (
                      <li key={pack.id} className="flex flex-col justify-between gap-3 rounded-xl border border-border p-3.5 transition-colors hover:border-border-strong">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{pack.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {pack.tokens.toLocaleString()} tokens{pack.expires_after_days ? ` · use within ${pack.expires_after_days} days` : ""}
                          </p>
                        </div>
                        <Button size="sm" className="w-full" disabled={busy !== null || !billing.online_payments} aria-busy={busy === pack.id || undefined} onClick={() => void buy(pack.id)}>
                          {busy === pack.id ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                          {was !== null ? (
                            <s className="text-xs font-medium">
                              <span className="sr-only">was </span>
                              {formatMoney(was, pack.currency)}
                            </s>
                          ) : null}
                          Buy for {formatMoney(now, pack.currency)}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                <form
                  className="flex max-w-sm gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void applyCoupon();
                  }}
                >
                  <div className="relative min-w-0 flex-1">
                    <Tag aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input aria-label="Coupon code" placeholder="Coupon code" className="pl-9" value={coupon} onChange={(event) => setCoupon(event.target.value)} />
                  </div>
                  <Button type="submit" variant="outline" disabled={busy !== null || !coupon.trim()} aria-busy={busy === "coupon" || undefined}>
                    {busy === "coupon" ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Apply
                  </Button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No token packs are available right now.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">The account owner can buy more tokens here.</p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
            {ledger.isPending ? (
              <ListSkeleton rows={3} className="mt-2" />
            ) : entries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No token activity yet.</p>
            ) : (
              <>
                <ul className="mt-1 divide-y divide-border">
                  {(showAll ? entries : entries.slice(0, LEDGER_PREVIEW)).map((entry) => (
                    <LedgerRow key={entry.id} entry={entry} />
                  ))}
                </ul>
                {entries.length > LEDGER_PREVIEW ? (
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowAll((open) => !open)}>
                    {showAll ? "Show less" : `Show all ${entries.length}`}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>

        <PriceList billing={billing} />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Invoices                                                                    */
/* -------------------------------------------------------------------------- */

function InvoicesPanel() {
  const [page, setPage] = useState(1);
  const invoices = useQuery({
    queryKey: ["billing", "invoices", page, INVOICES_PAGE_SIZE],
    queryFn: ({ signal }) => getInvoices(page, INVOICES_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const [downloading, setDownloading] = useState<string | null>(null);
  const download = (invoiceId: string) => {
    if (downloading) return;
    setDownloading(invoiceId);
    void downloadInvoicePdf(invoiceId)
      .then(({ blob, filename }) => saveBlob(blob, filename))
      .catch(() => toast.error("The invoice couldn't be downloaded. Try again."))
      .finally(() => setDownloading(null));
  };
  const data = invoices.data;

  return (
    <section aria-labelledby="billing-invoices-title" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3.5">
        <span aria-hidden className="-mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground ring-1 ring-inset ring-border-strong">
          <ReceiptText className="size-3.5" />
        </span>
        <div className="min-w-0">
          <h2 id="billing-invoices-title" className="text-[15px] font-semibold leading-6 text-foreground">
            Invoices
          </h2>
          <p className="text-[13px] text-muted-foreground">Newest first.</p>
        </div>
      </div>
      {invoices.isError ? (
        <ErrorState compact title="Invoices couldn't be loaded" description="Try again in a moment." onRetry={() => void invoices.refetch()} className="m-4 shadow-none" />
      ) : !data ? (
        <ListSkeleton rows={3} className="rounded-none border-0 shadow-none" />
      ) : data.invoices.length === 0 ? (
        <EmptyState compact icon={FileText} tone="settings" title="No invoices yet" description="Invoices appear here after your first payment." className="border-0" />
      ) : (
        <>
          <ul className="divide-y divide-border md:hidden">
            {data.invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{invoice.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {INVOICE_KIND[invoice.kind] ?? "Invoice"} · {formatDate(invoice.issued_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(invoice.total, invoice.currency)}</span>
                  <StatusBadge tone={INVOICE_STATUS[invoice.status]?.tone ?? "neutral"} size="sm">
                    {INVOICE_STATUS[invoice.status]?.label ?? invoice.status}
                  </StatusBadge>
                </div>
                {invoice.has_pdf ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Download invoice ${invoice.number}`}
                    disabled={downloading !== null}
                    aria-busy={downloading === invoice.id || undefined}
                    onClick={() => download(invoice.id)}
                  >
                    {downloading === invoice.id ? <LoaderCircle aria-hidden className="animate-spin" /> : <Download aria-hidden />}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <TableScroll minWidth={620} label="Invoices">
              <TableHead>
                <Th>Invoice</Th>
                <Th>Issued</Th>
                <Th>Status</Th>
                <Th align="right">Total</Th>
                <Th srOnly>Download</Th>
              </TableHead>
              <TableBody>
                {data.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <td className={tdClass}>
                      <span className="block font-medium text-foreground">{invoice.number}</span>
                      <span className="block text-xs text-muted-foreground">{INVOICE_KIND[invoice.kind] ?? "Invoice"}</span>
                    </td>
                    <td className={tdMutedClass}>{formatDate(invoice.issued_at)}</td>
                    <td className={tdClass}>
                      <StatusBadge tone={INVOICE_STATUS[invoice.status]?.tone ?? "neutral"}>{INVOICE_STATUS[invoice.status]?.label ?? invoice.status}</StatusBadge>
                    </td>
                    <td className={cn(tdNumberClass, "font-medium")}>{formatMoney(invoice.total, invoice.currency)}</td>
                    <td className={cn(tdClass, "text-right")}>
                      {invoice.has_pdf ? (
                        <Button size="sm" variant="ghost" disabled={downloading !== null} aria-busy={downloading === invoice.id || undefined} onClick={() => download(invoice.id)}>
                          {downloading === invoice.id ? <LoaderCircle aria-hidden className="animate-spin" /> : <Download aria-hidden />} PDF
                          <span className="sr-only"> of invoice {invoice.number}</span>
                        </Button>
                      ) : null}
                    </td>
                  </TableRow>
                ))}
              </TableBody>
            </TableScroll>
          </div>
          {data.total > data.limit ? (
            <TablePagination
              page={data.page}
              pageCount={Math.ceil(data.total / data.limit)}
              totalItems={data.total}
              pageSize={data.limit}
              itemLabel="invoices"
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Billing details                                                             */
/* -------------------------------------------------------------------------- */

const DETAIL_FIELDS: { key: keyof BillingDetails; label: string; type?: string; autoComplete?: string }[] = [
  { key: "name", label: "Billing name", autoComplete: "organization" },
  { key: "email", label: "Billing email", type: "email", autoComplete: "email" },
  { key: "address_line1", label: "Address", autoComplete: "address-line1" },
  { key: "address_line2", label: "Address line 2", autoComplete: "address-line2" },
  { key: "city", label: "City", autoComplete: "address-level2" },
  { key: "region", label: "Province or state", autoComplete: "address-level1" },
  { key: "postal_code", label: "Postal or ZIP code", autoComplete: "postal-code" },
  { key: "country", label: "Country", autoComplete: "country-name" },
];

type DetailsForm = Record<keyof BillingDetails, string>;

function DetailsPanel({ details, canPay }: { details: BillingDetails | null; canPay: boolean }) {
  const queryClient = useQueryClient();
  const initial = Object.fromEntries(DETAIL_FIELDS.map(({ key }) => [key, details?.[key] ?? ""])) as DetailsForm;
  const [saved, setSaved] = useState<DetailsForm>(initial);
  const [form, setForm] = useState<DetailsForm>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = DETAIL_FIELDS.some(({ key }) => form[key] !== saved[key]);

  const save = () => {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    void updateBillingDetails(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || null])))
      .then(() => {
        setSaved(form);
        setSavedAt(new Date().toLocaleTimeString());
        void queryClient.invalidateQueries({ queryKey: ["billing"] });
        void queryClient.invalidateQueries({ queryKey: ["organization", "usage"] });
      })
      .catch(() => setError("The details couldn't be saved. Try again."))
      .finally(() => setSaving(false));
  };

  return (
    <>
      <Panel title="Billing details" description="Printed on your next invoices. Invoices already issued keep the details of their date." icon={FileText} tone="settings">
        {!canPay ? <p className="mb-4 rounded-lg bg-surface-strong px-3 py-2 text-sm text-muted-foreground">Only the account owner can change these.</p> : null}
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <fieldset disabled={!canPay || saving}>
            <FormGrid>
              {DETAIL_FIELDS.map(({ key, label, type, autoComplete }) => (
                <FormTextField
                  key={key}
                  id={`billing-${key}`}
                  label={label}
                  {...(type ? { type } : {})}
                  {...(autoComplete ? { autoComplete } : {})}
                  value={form[key]}
                  onChange={(value) => {
                    setForm((current) => ({ ...current, [key]: value }));
                    setSavedAt(null);
                    setError(null);
                  }}
                />
              ))}
            </FormGrid>
          </fieldset>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Panel>
      {canPay && (dirty || savedAt || error) ? (
        <FormSaveBar
          dirty={dirty}
          saving={saving}
          hasErrors={false}
          savedAt={savedAt}
          error={error}
          onSave={save}
          onDiscard={() => {
            setForm(saved);
            setError(null);
          }}
          savedLabel="Billing details saved"
        />
      ) : null}
    </>
  );
}

export default SettingsBillingPage;
