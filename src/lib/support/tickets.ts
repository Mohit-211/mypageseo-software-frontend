import type { TicketStatus } from "@/api";

export const SUPPORT_KEY = ["support", "tickets"] as const;

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: "info" | "warning" | "success" | "neutral" }> = {
  open: { label: "Waiting for our team", tone: "info" },
  in_progress: { label: "In progress", tone: "info" },
  waiting_on_customer: { label: "Waiting for you", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};
