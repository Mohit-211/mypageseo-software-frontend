import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { BillingCaptureResult, BillingSummary, LocationSlotOrder, TokenLedger, TokenPack } from "../types/locations";

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
export async function checkoutTokens(packId: string): Promise<{ approve_url?: string; fulfilled: boolean }> {
  return unwrapData(await api.post(ENDPOINTS.billing.tokenCheckout, { pack_id: packId }));
}
