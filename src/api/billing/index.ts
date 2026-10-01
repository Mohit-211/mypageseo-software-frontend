import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { BillingCaptureResult, LocationSlotOrder } from "../types/locations";

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
