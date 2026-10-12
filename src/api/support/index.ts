import { api, unwrapData } from "../client";

export type TicketStatus = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
export type TicketCategory = "billing" | "technical" | "account" | "data" | "other";

export type TicketMessage = { id: string; author: { kind: "customer" | "team" | string; name: string }; body: string; created_at: string };

export type Ticket = {
  id: string;
  number: string;
  subject: string;
  category: TicketCategory | null;
  status: TicketStatus;
  priority: string | null;
  location_id: string | null;
  messages: number;
  last_message_at: string | null;
  last_message_by: string | null;
  created_at: string;
  closed_at: string | null;
  thread?: TicketMessage[];
};

export type TicketList = { tickets: Ticket[]; page: number; limit: number; total: number };

/** Any role; a client_user sees only its own tickets. Team replies read "MyPageSEO team". */
export async function getTickets(query: { status?: TicketStatus; page?: number; limit?: number } = {}, signal?: AbortSignal): Promise<TicketList> {
  return unwrapData(await api.get("support/tickets", { query, ...(signal ? { signal } : {}) }));
}

export async function getTicket(ticketId: string, signal?: AbortSignal): Promise<Ticket> {
  return unwrapData(await api.get(`support/tickets/${encodeURIComponent(ticketId)}`, signal ? { signal } : {}));
}

export async function createTicket(input: { subject: string; message: string; category?: TicketCategory; location_id?: string }): Promise<Ticket> {
  return unwrapData(await api.post("support/tickets", input));
}

/** Reopens a resolved ticket; 409 `ticket_closed` on a closed one. */
export async function replyToTicket(ticketId: string, message: string): Promise<Ticket> {
  return unwrapData(await api.post(`support/tickets/${encodeURIComponent(ticketId)}/messages`, { message }));
}

export async function closeTicket(ticketId: string): Promise<Ticket> {
  return unwrapData(await api.post(`support/tickets/${encodeURIComponent(ticketId)}/close`));
}
