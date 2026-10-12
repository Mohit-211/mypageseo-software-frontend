import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  BillingCaptureResult,
  BillingDetails,
  BillingSummary,
  CouponQuote,
  InvoiceList,
  LocationSlotOrder,
  LocationSlotQuote,
  SubscriptionCheckout,
  TokenLedger,
  TokenPack,
} from "../types/locations";

/** Buys extra location slots after a 402 `location_payment_required`. */
export async function buyLocationSlots(quantity = 1): Promise<LocationSlotOrder> {
  return unwrapData(await api.post(ENDPOINTS.billing.locationSlots, { quantity }));
}

/** PayPal order return (`?order=return&token=<orderId>`). Idempotent. */
export async function captureBillingOrder(orderId: string): Promise<BillingCaptureResult> {
  return unwrapData(await api.post(ENDPOINTS.billing.captureOrder(orderId)));
}

/** PayPal subscription return (`?checkout=success`). */
export async function syncBilling(): Promise<unknown> {
  return unwrapData(await api.post(ENDPOINTS.billing.sync));
}

/** `GET billing`: subscription state, limits and the token balance. Owner and member only. */
export async function getBillingSummary(signal?: AbortSignal): Promise<BillingSummary> {
  return unwrapData(await api.get(ENDPOINTS.billing.summary, signal ? { signal } : {}));
}

export async function getTokenLedger(limit = 20, signal?: AbortSignal): Promise<TokenLedger> {
  return unwrapData(await api.get(ENDPOINTS.billing.tokenLedger, { query: { limit }, ...(signal ? { signal } : {}) }));
}

export async function getTokenPacks(signal?: AbortSignal): Promise<{ currency: string; packs: TokenPack[] }> {
  return unwrapData(await api.get(ENDPOINTS.billing.tokenPacks, signal ? { signal } : {}));
}

/** PayPal sends `approve_url`; a 100% coupon answers `fulfilled: true`. */
export async function checkoutTokens(packId: string, couponCode?: string): Promise<{ approve_url?: string; fulfilled: boolean }> {
  return unwrapData(
    await api.post(ENDPOINTS.billing.tokenCheckout, { pack_id: packId, ...(couponCode ? { coupon_code: couponCode } : {}) }),
  );
}

/** Coupons apply to token packs only. 400 `invalid_coupon | coupon_expired | coupon_exhausted | coupon_not_applicable`. */
export async function validateCoupon(packId: string, couponCode: string): Promise<CouponQuote> {
  return unwrapData(await api.post(ENDPOINTS.billing.couponValidate, { pack_id: packId, coupon_code: couponCode }));
}

/**
 * Starts the PayPal subscription for `quantity` locations (1 to the plan cap, at least the active count).
 * 409 `price_not_set | already_subscribed | manual_billing`, 403 `enterprise_required`, 400 `quantity_below_active`.
 */
export async function checkoutSubscription(quantity: number): Promise<SubscriptionCheckout> {
  return unwrapData(await api.post(ENDPOINTS.billing.checkout, { quantity }));
}

/** Cancels at the end of the paid period; returns the `GET billing` body. 409 `no_subscription | manual_billing`. */
export async function cancelSubscription(reason?: string): Promise<BillingSummary> {
  return unwrapData(await api.post(ENDPOINTS.billing.cancel, reason ? { reason } : {}));
}

export async function getLocationSlotQuote(quantity = 1, signal?: AbortSignal): Promise<LocationSlotQuote> {
  return unwrapData(await api.get(ENDPOINTS.billing.locationSlotsQuote, { query: { quantity }, ...(signal ? { signal } : {}) }));
}

export async function getInvoices(page = 1, limit = 20, signal?: AbortSignal): Promise<InvoiceList> {
  return unwrapData(await api.get(ENDPOINTS.billing.invoices, { query: { page, limit }, ...(signal ? { signal } : {}) }));
}

export async function downloadInvoicePdf(invoiceId: string): Promise<{ blob: Blob; filename: string }> {
  const response = await api.get<Response>(ENDPOINTS.billing.invoicePdf(invoiceId), { responseType: "blob", timeoutMs: 60_000 });
  const match = /filename="?([^";]+)"?/i.exec(response.headers.get("Content-Disposition") ?? "");
  return { blob: await response.blob(), filename: match?.[1] ?? `invoice-${invoiceId}.pdf` };
}

/** Printed on the next invoices; issued invoices keep their details. */
export async function updateBillingDetails(details: Partial<BillingDetails>): Promise<BillingDetails> {
  return unwrapData(await api.patch(ENDPOINTS.billing.details, details));
}
