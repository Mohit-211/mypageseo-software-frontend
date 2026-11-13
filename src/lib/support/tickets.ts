import { isApiError, type TicketCategory, type TicketStatus } from "@/api";
import type { StatusTone } from "@/components/layout/shared/module-tone";

export const SUPPORT_KEY = ["support", "tickets"] as const;

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: Extract<StatusTone, "info" | "warning" | "success" | "neutral"> }> = {
  open: { label: "Waiting for our team", tone: "info" },
  in_progress: { label: "In progress", tone: "info" },
  waiting_on_customer: { label: "Waiting for you", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

/** Ticket topics in plain words (the new-ticket form and the ticket list). */
export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  technical: "Something isn't working",
  data: "Rankings or data question",
  billing: "Billing",
  account: "Account or access",
  other: "Something else",
};

/** Retry only failures that may pass on a second try; a 404 (another organization's ticket) is an answer. */
export function retryUnlessClientError(count: number, err: unknown): boolean {
  return !(isApiError(err) && err.status < 500) && count < 2;
}
