/**
 * Subscription and billing contract.
 *
 * Mypageseo bills through an external billing portal, so this screen only
 * reads subscription state, plan limits, payment-method summary and invoice
 * history — it never rebuilds payment management. Plans mirror the two account
 * types the product already has (Business and Agency); no additional tier,
 * price, limit or billing state is invented here.
 *
 * Real payloads are authoritative; the demo snapshot is used only while the
 * billing backend is unavailable during frontend development.
 */

import { withDemoFallback } from "./demo/demo-mode";
import { DEMO_BILLING } from "./demo/billing";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "paused";

export type BillingInterval = "monthly" | "annual";

export type UsageMetric = {
  id: string;
  label: string;
  used: number;
  /** null when the plan does not limit this metric. */
  limit: number | null;
  unit?: string;
};

export type PaymentMethod = {
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
};

export type InvoiceStatus = "paid" | "open" | "past_due" | "void";

export type Invoice = {
  id: string;
  number: string;
  issuedAt: string;
  amount: string;
  status: InvoiceStatus;
  /** Present only when the billing provider exposes a hosted invoice. */
  url: string | null;
};

export type Subscription = {
  planName: string;
  planAccountType: "business" | "agency";
  status: SubscriptionStatus;
  interval: BillingInterval;
  price: string;
  startedAt: string;
  /** Next renewal, or the end of the current period for canceled plans. */
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  /** Set when the subscription needs attention (payment failure, trial ending). */
  attention: string | null;
};

export type BillingCapabilities = {
  canManage: boolean;
  /** The provider's hosted portal handles plan changes, payment and cancellation. */
  portalUrl: string | null;
  canChangePlan: boolean;
  canCancel: boolean;
};

export type BillingResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "no_subscription"; reason: string }
  | {
      status: "ready";
      subscription: Subscription;
      usage: UsageMetric[];
      paymentMethod: PaymentMethod | null;
      invoices: Invoice[];
      capabilities: BillingCapabilities;
    };

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  canceled: "Canceled",
  paused: "Paused",
};

export const SUBSCRIPTION_STATUS_TONE: Record<
  SubscriptionStatus,
  "success" | "info" | "warning" | "critical" | "neutral"
> = {
  active: "success",
  trialing: "info",
  past_due: "critical",
  canceled: "neutral",
  paused: "warning",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: "Paid",
  open: "Open",
  past_due: "Past due",
  void: "Void",
};

export const INVOICE_STATUS_TONE: Record<
  InvoiceStatus,
  "success" | "info" | "critical" | "neutral"
> = {
  paid: "success",
  open: "info",
  past_due: "critical",
  void: "neutral",
};

export const BILLING_INTERVAL_LABEL: Record<BillingInterval, string> = {
  monthly: "Billed monthly",
  annual: "Billed annually",
};

export function formatBillingDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function usagePercent(metric: UsageMetric): number | null {
  if (metric.limit === null || metric.limit === 0) return null;
  return Math.min(100, Math.round((metric.used / metric.limit) * 100));
}

export function getBilling(
  accountType: "business" | "agency",
  real?: BillingResult | null,
): BillingResult {
  return withDemoFallback(real, () => DEMO_BILLING(accountType));
}
