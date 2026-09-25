/**
 * Notification preferences.
 *
 * Preference types mirror the notification categories the product already
 * produces (see `notifications.ts`): ranking, GBP, review, citation, report and
 * automation events, plus mandatory account/security notices. Channels are
 * limited to the two Mypageseo delivers today — email and in-app. No other
 * channel, scope or event type is exposed.
 *
 * Preferences are edited as a group and committed with an explicit Save, which
 * matches the organization-settings contract used elsewhere in Settings. Real
 * payloads always win; the demo defaults are only used while the preferences
 * backend is unavailable.
 */

import { withDemoFallback } from "./demo/demo-mode";
import { DEMO_NOTIFICATION_PREFERENCES } from "./demo/notification-settings";
import type { NotificationCategory } from "./notifications";

export type NotificationChannel = "email" | "in_app";

export type PreferenceGroup = "activity" | "delivery" | "account";

export type NotificationPreference = {
  id: string;
  category: NotificationCategory | "account";
  group: PreferenceGroup;
  label: string;
  description: string;
  /** Channels the backend can deliver this event on. */
  supportedChannels: NotificationChannel[];
  /** Currently enabled channels. */
  channels: NotificationChannel[];
  /** Always-on system notices cannot be turned off. */
  required: boolean;
};

/** Digest frequency for the email channel, the only frequency control supported. */
export type EmailFrequency = "immediate" | "daily" | "weekly";

export type NotificationPreferences = {
  preferences: NotificationPreference[];
  emailFrequency: EmailFrequency;
  /** Email address alerts are delivered to. */
  deliveryEmail: string;
  /**
   * Preferences apply to every location the user can access; the backend has
   * no per-client or per-location notification scope.
   */
  scopeNote: string;
};

export type NotificationCapabilities = {
  canEdit: boolean;
  canSave: boolean;
};

export type NotificationSettingsResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unavailable"; reason: string }
  | {
      status: "ready";
      preferences: NotificationPreferences;
      capabilities: NotificationCapabilities;
    };

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  email: "Email",
  in_app: "In-app",
};

export const EMAIL_FREQUENCY_LABEL: Record<EmailFrequency, string> = {
  immediate: "As it happens",
  daily: "Daily summary",
  weekly: "Weekly summary",
};

export const GROUP_TITLE: Record<PreferenceGroup, string> = {
  activity: "Location activity",
  delivery: "Reports and automations",
  account: "Account and security",
};

export const GROUP_DESCRIPTION: Record<PreferenceGroup, string> = {
  activity: "Alerts about rankings, Google Business Profile, reviews and citations",
  delivery: "Report generation, scheduled delivery and automation runs",
  account: "Sign-in and account notices required for every user",
};

export function getNotificationSettings(
  accountType: "business" | "agency",
  real?: NotificationSettingsResult | null,
): NotificationSettingsResult {
  return withDemoFallback(real, () => DEMO_NOTIFICATION_PREFERENCES(accountType));
}

export function toggleChannel(
  preferences: NotificationPreferences,
  preferenceId: string,
  channel: NotificationChannel,
): NotificationPreferences {
  return {
    ...preferences,
    preferences: preferences.preferences.map((preference) => {
      if (preference.id !== preferenceId || preference.required) return preference;
      if (!preference.supportedChannels.includes(channel)) return preference;
      const enabled = preference.channels.includes(channel);
      return {
        ...preference,
        channels: enabled
          ? preference.channels.filter((c) => c !== channel)
          : [...preference.channels, channel],
      };
    }),
  };
}

export function preferencesAreEqual(
  a: NotificationPreferences,
  b: NotificationPreferences,
): boolean {
  if (a.emailFrequency !== b.emailFrequency) return false;
  if (a.preferences.length !== b.preferences.length) return false;
  return a.preferences.every((preference, index) => {
    const other = b.preferences[index];
    if (!other || other.id !== preference.id) return false;
    if (other.channels.length !== preference.channels.length) return false;
    return preference.channels.every((channel) => other.channels.includes(channel));
  });
}

/** Email frequency only matters when at least one email alert is enabled. */
export function emailAlertsEnabled(preferences: NotificationPreferences): boolean {
  return preferences.preferences.some((preference) => preference.channels.includes("email"));
}
