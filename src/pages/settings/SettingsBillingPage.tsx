import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Download, LoaderCircle, MapPinPlus } from "lucide-react";
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
  type BillingSummary,
  type CouponQuote,
} from "@/api";
import { RequireAccess } from "@/components/mypageseo/access";
import { AppShell } from "@/components/layout/shared/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { PaypalReturnNotice } from "@/components/settings/paypal-return-notice";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccess } from "@/hooks/use-access";
import { useBilling } from "@/lib/billing/use-billing";
import { formatDate } from "@/lib/datetime";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { formatMoney, saveBlob } from "@/lib/utils";

const STATE_LABEL: Record<BillingSummary["state"], { label: string; tone: "success" | "info" | "warning" | "critical" | "neutral" }> = {
  trialing: { label: "Free trial", tone: "info" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Payment failed", tone: "warning" },
  inactive: { label: "Read-only", tone: "critical" },
  suspended_by_admin: { label: "Suspended", tone: "critical" },
};

const CHECKOUT_ERRORS: Record<string, string> = {
  price_not_set: "Billing opens soon: prices haven't been set yet.",
  already_subscribed: "This organization already has a subscription.",
  manual_billing: "This organization is billed by invoice. Contact us to change it.",
  enterprise_required: "More than 20 locations needs an enterprise plan. Contact us.",
  billing_not_configured: "Online payments aren't set up yet.",
  no_subscription: "There's no subscription to cancel.",
  owner_only: "Only the account owner can make payments.",
};

function checkoutError(err: unknown): string {
  if (!isApiError(err)) return "That didn't work. Try again.";
  if (err.reason === "quantity_below_active") return `You have ${String(apiErrorData(err).active ?? "more")} active locations; subscribe for at least that many.`;
  return (err.reason && CHECKOUT_ERRORS[err.reason]) ?? (err.status === 503 ? CHECKOUT_ERRORS.billing_not_configured : "That didn't work. Try again.");
}

/** One billing page (Phase 13a): plan, subscription, extra locations, tokens, invoices and details. Owners pay; members read. */
const SettingsBillingPage = () => (
  <RequireAccess permission="billing.view">
    <BillingPage />
  </RequireAccess>
);

function BillingPage() {
  const workspace = useWorkspace();
  const billing = useBilling();
  const canPay = useAccess().can("billing.manage");

  return (
    <AppShell>
      <PageHeader title="Billing" description="Your plan, locations, tokens and invoices." />
      <SettingsNav active="billing" isAgency={workspace.organization?.accountType === "agency"} />
      <PaypalReturnNotice />
      {billing.isPending ? (
        <PageSkeleton />
      ) : billing.isError ? (
        <ErrorState description="Billing couldn't be loaded." onRetry={() => void billing.refetch()} />
      ) : (
        <div className="space-y-6">
          <PlanPanel billing={billing.data} canPay={canPay} />
          <TokensPanel billing={billing.data} canPay={canPay} />
          <InvoicesPanel />
          <DetailsPanel details={billing.data.billing_details ?? null} canPay={canPay} />
        </div>
      )}
    </AppShell>
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

  const subscribe = async () => {
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
    setBusy("slot");
    try {
      const order = await buyLocationSlots(1);
      if (order.fulfilled) {
        void queryClient.invalidateQueries({ queryKey: ["billing"] });
        void queryClient.invalidateQueries({ queryKey: ["organization", "usage"] });
        toast.success("The extra location is available now; it's added to your next invoice.");
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
    <Panel title={billing.plan?.name ? `${billing.plan.name} plan` : "Plan"} actions={<StatusBadge tone={state.tone}>{state.label}</StatusBadge>}>
      <div className="space-y-4">
        <section className="-mx-4 grid border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-border">
          <MetricCard label="Locations" value={`${billing.locations?.active ?? "—"} of ${billing.locations?.allowed ?? "—"}`} caption={`Paid or allowed now · up to ${max} on this plan`} />
          <MetricCard label="Users" value={`${billing.users?.used ?? "—"} of ${billing.users?.limit ?? "—"}`} caption={`${billing.plan?.users_per_location ?? 3} per paid location, owner included`} />
          <MetricCard
            label="Next renewal"
            value={billing.next_renewal ? formatMoney(billing.next_renewal.amount, billing.currency) : "—"}
            caption={billing.next_renewal ? `${formatDate(billing.next_renewal.date)} · ${billing.next_renewal.quantity} location${billing.next_renewal.quantity === 1 ? "" : "s"}${billing.next_renewal.fixed ? "" : " (estimate)"}` : "No renewal scheduled"}
          />
        </section>

        <div className="space-y-1 text-sm text-muted-foreground">
          {billing.state === "trialing" && billing.trial_ends_at ? <p>Your free trial ends on {formatDate(billing.trial_ends_at)}. After that the account is read-only until you subscribe.</p> : null}
          {billing.state === "past_due" && billing.grace_ends_at ? <p className="text-warning-foreground">Your last payment failed. Full access continues until {formatDate(billing.grace_ends_at)}.</p> : null}
          {billing.state === "inactive" ? <p className="text-critical">The account is read-only: everything stays visible, but refreshes, new locations and AI actions are paused until you subscribe.</p> : null}
          {subscription?.cancel_at_period_end && subscription.current_period_end ? <p>Cancelled: access continues until {formatDate(subscription.current_period_end)}.</p> : null}
          {prices ? (
            <p>
              {formatMoney(prices.first_location, billing.currency)} a month for the first location, {formatMoney(prices.additional_location, billing.currency)} for each additional one. All features included.
              {billing.prices?.upcoming ? ` From ${formatDate(billing.prices.upcoming.effective_from)}: ${formatMoney(billing.prices.upcoming.first_location, billing.currency)} and ${formatMoney(billing.prices.upcoming.additional_location, billing.currency)}.` : ""}
            </p>
          ) : (
            <p>Billing opens soon: prices haven't been set yet.</p>
          )}
          {!billing.online_payments ? <p>Online payments aren't set up yet.</p> : null}
        </div>

        {canPay && !subscribed && billing.state !== "suspended_by_admin" ? (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label>Locations to pay for</Label>
              <Select value={quantity} onValueChange={setQuantity}>
                <SelectTrigger className="w-28 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: max - Math.max(1, active) + 1 }, (_, index) => String(Math.max(1, active) + index)).map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={busy !== null || !prices || !billing.online_payments} onClick={() => void subscribe()}>
              {busy === "subscribe" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
              Subscribe{monthly(Number(quantity)) != null ? ` · ${formatMoney(monthly(Number(quantity))!, billing.currency)}/month` : ""}
            </Button>
            <p className="text-xs text-muted-foreground sm:ml-2">You'll approve it with PayPal and come back here. More than {max} locations: contact us.</p>
          </div>
        ) : null}

        {canPay && subscribed ? (
          <div className="flex flex-wrap gap-2">
            {slotQuote ? (
              <div className="w-full space-y-2 rounded-md border border-border p-3 text-sm">
                {(slotQuote.lines ?? []).map((line) => (
                  <p key={line.label} className="flex justify-between gap-3"><span>{line.label}</span><span className="tabular">{formatMoney(line.amount, slotQuote.currency)}</span></p>
                ))}
                <p className="flex justify-between gap-3 font-semibold"><span>Total now</span><span className="tabular">{formatMoney(slotQuote.amount, slotQuote.currency)}</span></p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy !== null} onClick={() => void buySlot()}>{busy === "slot" ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Pay with PayPal</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSlotQuote(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void quoteSlot()}>
                {busy === "quote" ? <LoaderCircle aria-hidden className="animate-spin" /> : <MapPinPlus aria-hidden />} Add a location slot
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-critical" disabled={busy !== null} onClick={() => setConfirmCancel(true)}>Cancel subscription</Button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">Removing a location refunds nothing; its slot stays paid and reusable until the period ends.</p>
      </div>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel the subscription?"
        description="Everything keeps working until the end of the paid period. After that the account becomes read-only."
        confirmLabel="Cancel subscription"
        onConfirm={() => {
          setConfirmCancel(false);
          void cancel();
        }}
      />
    </Panel>
  );
}

function TokensPanel({ billing, canPay }: { billing: BillingSummary; canPay: boolean }) {
  const packs = useQuery({ queryKey: ["billing", "token-packs"], queryFn: ({ signal }) => getTokenPacks(signal), retry: false });
  const ledger = useQuery({ queryKey: ["billing", "ledger"], queryFn: ({ signal }) => getTokenLedger(20, signal), retry: false });
  const [coupon, setCoupon] = useState("");
  const [quotes, setQuotes] = useState<Record<string, CouponQuote>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const tokens = billing.tokens;

  const applyCoupon = async () => {
    if (!packs.data) return;
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
    } else toast.success("Coupon applied.");
  };

  const buy = async (packId: string) => {
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
    <Panel title="Tokens" description="Manual refreshes and AI actions spend tokens. The automatic monthly refresh is free. Packs never expire unless noted.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-lg font-semibold text-foreground"><Coins aria-hidden className="size-5 text-brand-soft" /> {tokens.balance} tokens</span>
          <span className="text-muted-foreground">
            Rankings refresh {tokens.cost_per_refresh.rankings} · GBP refresh {tokens.cost_per_refresh.gbp}
            {tokens.ai_costs ? ` · ${Object.entries(tokens.ai_costs).map(([key, cost]) => `${key.replace(/_/g, " ")} ${cost}`).join(" · ")}` : ""}
          </span>
          {tokens.monthly_grant ? <span className="text-muted-foreground">+{tokens.monthly_grant} each month{tokens.next_grant_at ? ` (next ${formatDate(tokens.next_grant_at)})` : ""}</span> : null}
        </div>
        {canPay ? (
          packs.data?.packs.length ? (
            <>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {packs.data.packs.map((pack) => {
                  const quote = quotes[pack.id];
                  return (
                    <li key={pack.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{pack.name}</p>
                        <p className="text-xs text-muted-foreground">{pack.tokens} tokens{pack.expires_after_days ? ` · valid ${pack.expires_after_days} days` : ""}</p>
                      </div>
                      <Button size="sm" disabled={busy !== null || !billing.online_payments} onClick={() => void buy(pack.id)}>
                        {busy === pack.id ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                        {quote ? <s className="mr-1 text-xs opacity-70">{formatMoney(quote.price, quote.currency)}</s> : null}
                        {formatMoney(quote ? quote.total : pack.price, pack.currency)}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex max-w-sm gap-2">
                <Input placeholder="Coupon code" value={coupon} onChange={(event) => setCoupon(event.target.value)} />
                <Button variant="outline" disabled={busy !== null || !coupon.trim()} onClick={() => void applyCoupon()}>
                  {busy === "coupon" ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Apply
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{packs.isPending ? "Loading packs…" : "No token packs are available right now."}</p>
          )
        ) : null}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Recent activity</p>
          {ledger.data?.entries.length ? (
            <ul className="divide-y divide-border text-sm">
              {ledger.data.entries.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3 py-1.5">
                  <span>{entry.note ?? entry.type.replace(/_/g, " ")} <span className="text-xs text-muted-foreground">· {formatDate(entry.at)}</span></span>
                  <span className={entry.amount < 0 ? "tabular text-muted-foreground" : "tabular text-success"}>{entry.amount > 0 ? "+" : ""}{entry.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{ledger.isPending ? "Loading…" : "No token activity yet."}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function InvoicesPanel() {
  const invoices = useQuery({ queryKey: ["billing", "invoices"], queryFn: ({ signal }) => getInvoices(1, 24, signal), retry: false });
  const [downloading, setDownloading] = useState<string | null>(null);
  const download = (invoiceId: string) => {
    setDownloading(invoiceId);
    void downloadInvoicePdf(invoiceId)
      .then(({ blob, filename }) => saveBlob(blob, filename))
      .catch(() => toast.error("The invoice couldn't be downloaded."))
      .finally(() => setDownloading(null));
  };
  return (
    <Panel title="Invoices">
      {invoices.isError ? (
        <ErrorState description="Invoices couldn't be loaded." onRetry={() => void invoices.refetch()} />
      ) : !invoices.data?.invoices.length ? (
        <p className="text-sm text-muted-foreground">{invoices.isPending ? "Loading…" : "No invoices yet."}</p>
      ) : (
        <div className="-m-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border bg-surface-strong text-xs text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">Invoice</th><th className="px-3 py-2.5 font-medium">Issued</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 text-right font-medium">Total</th><th className="px-3 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.data.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-4 py-2.5"><span className="font-medium text-foreground">{invoice.number}</span><span className="block text-xs capitalize text-muted-foreground">{invoice.kind.replace(/_/g, " ")}</span></td>
                  <td className="px-3 py-2.5">{formatDate(invoice.issued_at)}</td>
                  <td className="px-3 py-2.5"><StatusBadge tone={invoice.status === "paid" ? "success" : invoice.status === "open" ? "warning" : "neutral"}>{invoice.status}</StatusBadge></td>
                  <td className="px-3 py-2.5 text-right tabular">{formatMoney(invoice.total, invoice.currency)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {invoice.has_pdf ? (
                      <Button size="sm" variant="ghost" disabled={downloading !== null} onClick={() => download(invoice.id)}>
                        {downloading === invoice.id ? <LoaderCircle aria-hidden className="animate-spin" /> : <Download aria-hidden />} PDF
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

const DETAIL_FIELDS: { key: keyof BillingDetails; label: string }[] = [
  { key: "name", label: "Billing name" },
  { key: "email", label: "Billing email" },
  { key: "address_line1", label: "Address" },
  { key: "address_line2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "region", label: "Province / state" },
  { key: "postal_code", label: "Postal / ZIP code" },
  { key: "country", label: "Country" },
];

function DetailsPanel({ details, canPay }: { details: BillingDetails | null; canPay: boolean }) {
  const queryClient = useQueryClient();
  const initial = Object.fromEntries(DETAIL_FIELDS.map(({ key }) => [key, details?.[key] ?? ""])) as Record<keyof BillingDetails, string>;
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = () => {
    setSaving(true);
    void updateBillingDetails(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || null])))
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["billing"] });
        void queryClient.invalidateQueries({ queryKey: ["organization", "usage"] });
        toast.success("Billing details saved. They print on your next invoices.");
      })
      .catch(() => toast.error("The details couldn't be saved."))
      .finally(() => setSaving(false));
  };

  return (
    <Panel title="Billing details" description="Printed on your next invoices; issued invoices keep the details of their date.">
      <fieldset disabled={!canPay || saving} className="grid gap-3 sm:grid-cols-2">
        {DETAIL_FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`billing-${key}`}>{label}</Label>
            <Input id={`billing-${key}`} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
          </div>
        ))}
        {canPay ? (
          <div className="sm:col-span-2">
            <Button disabled={!dirty || saving} onClick={save}>{saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save details</Button>
          </div>
        ) : null}
      </fieldset>
    </Panel>
  );
}

export default SettingsBillingPage;
