/**
 * Deterministic demo billing snapshot, used only while the billing backend is
 * unavailable. Replace by wiring the real billing provider response.
 */

import { DEMO_CLIENTS, DEMO_LOCATIONS, demoKeywords } from "./entities";
import type { BillingResult } from "../billing";

export function DEMO_BILLING(accountType: "business" | "agency"): BillingResult {
  const isAgency = accountType === "agency";
  const locations = isAgency
    ? DEMO_LOCATIONS.length
    : DEMO_LOCATIONS.filter((location) => location.clientId === DEMO_CLIENTS[0]?.id).length || 3;
  const keywords = DEMO_LOCATIONS.slice(0, locations).reduce(
    (total, location) => total + demoKeywords(location.id).length,
    0,
  );

  return {
    status: "ready",
    subscription: {
      planName: isAgency ? "Agency" : "Business",
      planAccountType: accountType,
      status: "active",
      interval: "monthly",
      price: isAgency ? "$399.00 / month" : "$149.00 / month",
      startedAt: "2025-11-01",
      currentPeriodEnd: "2026-10-01",
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
      attention: null,
    },
    usage: [
      {
        id: "locations",
        label: "Locations",
        used: locations,
        limit: isAgency ? 50 : 10,
      },
      {
        id: "keywords",
        label: "Tracked keywords",
        used: keywords,
        limit: isAgency ? 1500 : 300,
      },
      {
        id: "clients",
        label: "Clients",
        used: isAgency ? DEMO_CLIENTS.length : 0,
        limit: isAgency ? 25 : 0,
      },
      {
        id: "reports",
        label: "Reports this period",
        used: isAgency ? 18 : 4,
        limit: null,
      },
    ].filter((metric) => !(metric.id === "clients" && !isAgency)),
    paymentMethod: {
      brand: "Visa",
      last4: "4242",
      expiryMonth: 8,
      expiryYear: 2028,
    },
    invoices: [
      { id: "in_5", number: "MPS-2026-0009", issuedAt: "2026-09-01", amount: isAgency ? "$399.00" : "$149.00", status: "paid", url: null },
      { id: "in_4", number: "MPS-2026-0008", issuedAt: "2026-08-01", amount: isAgency ? "$399.00" : "$149.00", status: "paid", url: null },
      { id: "in_3", number: "MPS-2026-0007", issuedAt: "2026-07-01", amount: isAgency ? "$399.00" : "$149.00", status: "paid", url: null },
      { id: "in_2", number: "MPS-2026-0006", issuedAt: "2026-06-01", amount: isAgency ? "$399.00" : "$149.00", status: "paid", url: null },
      { id: "in_1", number: "MPS-2026-0005", issuedAt: "2026-05-01", amount: isAgency ? "$399.00" : "$149.00", status: "paid", url: null },
    ],
    capabilities: {
      canManage: true,
      // No billing provider is connected to this workspace yet.
      portalUrl: null,
      canChangePlan: false,
      canCancel: false,
    },
  };
}
