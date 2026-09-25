/**
 * Deterministic demo notification preferences, used only while the
 * preferences backend is unavailable.
 */

import type {
  NotificationPreference,
  NotificationSettingsResult,
} from "../notification-settings";

const BOTH: NotificationPreference["supportedChannels"] = ["email", "in_app"];

const BASE: NotificationPreference[] = [
  {
    id: "ranking_movement",
    category: "ranking",
    group: "activity",
    label: "Significant ranking changes",
    description: "A tracked keyword gains or loses positions beyond your alert threshold.",
    supportedChannels: BOTH,
    channels: ["email", "in_app"],
    required: false,
  },
  {
    id: "gbp_issue",
    category: "gbp",
    group: "activity",
    label: "Google Business Profile issues",
    description: "Profile suspensions, edits by Google, or missing profile information.",
    supportedChannels: BOTH,
    channels: ["email", "in_app"],
    required: false,
  },
  {
    id: "unanswered_reviews",
    category: "review",
    group: "activity",
    label: "New and unanswered reviews",
    description: "New reviews arrive, or replies stay outstanding past your response window.",
    supportedChannels: BOTH,
    channels: ["in_app"],
    required: false,
  },
  {
    id: "citation_change",
    category: "citation",
    group: "activity",
    label: "Citation changes",
    description: "Business name, address or phone details change on a monitored directory.",
    supportedChannels: BOTH,
    channels: ["email"],
    required: false,
  },
  {
    id: "report_ready",
    category: "report",
    group: "delivery",
    label: "Report generated",
    description: "A report you requested or scheduled has finished generating.",
    supportedChannels: BOTH,
    channels: ["email", "in_app"],
    required: false,
  },
  {
    id: "report_failed",
    category: "report",
    group: "delivery",
    label: "Scheduled report failed",
    description: "A scheduled report could not be generated or delivered.",
    supportedChannels: BOTH,
    channels: ["email", "in_app"],
    required: false,
  },
  {
    id: "automation_failed",
    category: "automation",
    group: "delivery",
    label: "Automation failed",
    description: "An automation run finished with errors or could not complete.",
    supportedChannels: BOTH,
    channels: ["email", "in_app"],
    required: false,
  },
  {
    id: "account_security",
    category: "account",
    group: "account",
    label: "Sign-in and security notices",
    description: "Password changes, new sign-in locations and other account security events.",
    supportedChannels: ["email"],
    channels: ["email"],
    required: true,
  },
];

export function DEMO_NOTIFICATION_PREFERENCES(
  accountType: "business" | "agency",
): NotificationSettingsResult {
  return {
    status: "ready",
    preferences: {
      preferences: BASE.map((preference) => ({ ...preference })),
      emailFrequency: "daily",
      deliveryEmail:
        accountType === "agency"
          ? "alina.petrov@northbounddigital.com"
          : "operations@riversidedental.com",
      scopeNote:
        accountType === "agency"
          ? "These preferences are yours and cover every client and location you can access. Mypageseo has no separate per-client notification settings."
          : "These preferences are yours and cover every location in your organization.",
    },
    capabilities: {
      canEdit: true,
      // Saving preferences needs the account service, which is not connected.
      canSave: false,
    },
  };
}
