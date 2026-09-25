/**
 * Notifications contract, shared by the header surface and the
 * `/notifications` inbox. Categories mirror the product events Mypageseo
 * already generates; nothing beyond the backend shape is invented here.
 */
import { withDemoFallback } from "./demo/demo-mode";
import { demoNotifications } from "./demo/notifications";

export type NotificationCategory =
  | "ranking"
  | "gbp"
  | "review"
  | "citation"
  | "report"
  | "automation"
  | "billing"
  | "system";

/** Reference to the Mypageseo object a notification is about, when supplied. */
export type NotificationTarget =
  | { kind: "location"; locationId: string }
  | { kind: "location_gbp"; locationId: string }
  | { kind: "location_reviews"; locationId: string }
  | { kind: "location_rankings"; locationId: string }
  | { kind: "location_citations"; locationId: string }
  | { kind: "report"; reportId: string }
  | { kind: "automation"; automationId: string }
  | { kind: "billing" };

export type NotificationItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  /** Client the notification belongs to, when the backend supplies one. */
  clientId?: string;
  clientName?: string;
  locationId?: string;
  locationName?: string;
  /** Navigation target for the related record, when the reference exists. */
  target?: NotificationTarget;
};

export type NotificationsData = {
  status: "ready" | "no_notifications";
  notifications: NotificationItem[];
  unreadCount: number;
};

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  ranking: "Ranking",
  gbp: "Google Business Profile",
  review: "Reviews",
  citation: "Citations",
  report: "Reports",
  automation: "Automations",
  billing: "Billing",
  system: "System",
};

export const NOTIFICATION_CATEGORY_TONE: Record<
  NotificationCategory,
  "brand" | "info" | "warning" | "neutral" | "success"
> = {
  ranking: "info",
  gbp: "warning",
  review: "success",
  citation: "warning",
  report: "brand",
  automation: "neutral",
  billing: "brand",
  system: "neutral",
};

/** Actions the notifications backend supports today. */
export type NotificationCapabilities = {
  canMarkRead: boolean;
  canMarkUnread: boolean;
  canMarkAllRead: boolean;
  canDelete: boolean;
};

export const NOTIFICATION_CAPABILITIES: NotificationCapabilities = {
  // Read-state changes are handled locally in the client today; no delete
  // endpoint exists in the notifications backend.
  canMarkRead: true,
  canMarkUnread: true,
  canMarkAllRead: true,
  canDelete: false,
};

export function getNotifications(real?: NotificationsData | null): NotificationsData {
  return withDemoFallback(real, () => {
    const notifications = demoNotifications();
    return {
      status: notifications.length > 0 ? "ready" : "no_notifications",
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    };
  });
}

export function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatNotificationTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
