/**
 * Automations contract: recurring and event-based local SEO tasks the platform
 * can execute (scheduled scans, alerts, GBP posting and report delivery).
 *
 * The automations backend is not wired into this frontend yet, so reads fall
 * back to a deterministic demo dataset. Real payloads stay authoritative when
 * they are passed in.
 */
import { withDemoFallback } from "./demo/demo-mode";
import { demoAutomations } from "./demo/automations";

export type AutomationType =
  | "rank_change_alert"
  | "review_alert"
  | "citation_monitor"
  | "gbp_post_scheduler"
  | "report_delivery";

/** Configuration state of the automation itself. */
export type AutomationStatus = "active" | "paused" | "running" | "failed";

/** Result of a single execution — separate from the automation's own state. */
export type AutomationRunStatus = "success" | "partial" | "failed" | "running";

export type AutomationRun = {
  id: string;
  startedAt: string;
  status: AutomationRunStatus;
  summary: string | null;
};

export type Automation = {
  id: string;
  name: string;
  type: AutomationType;
  clientId: string | null;
  clientName: string | null;
  locationId: string | null;
  locationName: string | null;
  /** Human-readable trigger or cadence, e.g. "Daily" or "Real-time". */
  frequency: string | null;
  status: AutomationStatus;
  lastRunAt: string | null;
  lastRunStatus: AutomationRunStatus | null;
  lastRunSummary: string | null;
  nextRunAt: string | null;
  failureReason: string | null;
  /** Most recent executions, newest first. Empty when history is unavailable. */
  recentRuns: AutomationRun[];
};

export type AutomationsCapabilities = {
  canCreate: boolean;
  canEdit: boolean;
  canPause: boolean;
  canRunNow: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  canViewHistory: boolean;
  availableTypes: AutomationType[];
};

export type AutomationsData = {
  status: "loading" | "ready" | "no_automations" | "error";
  automations: Automation[];
  capabilities: AutomationsCapabilities;
};

export const AUTOMATION_TYPE_LABEL: Record<AutomationType, string> = {
  rank_change_alert: "Ranking change alert",
  review_alert: "New review alert",
  citation_monitor: "Citation monitor",
  gbp_post_scheduler: "GBP post scheduler",
  report_delivery: "Report delivery",
};

export const AUTOMATION_TYPE_DESCRIPTION: Record<AutomationType, string> = {
  rank_change_alert: "Notify the team when tracked keyword positions move significantly.",
  review_alert: "Notify the team as soon as a new review is posted.",
  citation_monitor: "Re-check directory listings on a schedule and flag NAP inconsistencies.",
  gbp_post_scheduler: "Publish Google Business Profile posts on a recurring schedule.",
  report_delivery: "Generate and deliver a report on a recurring schedule.",
};

export const AUTOMATION_STATUS_LABEL: Record<AutomationStatus, string> = {
  active: "Active",
  paused: "Paused",
  running: "Running",
  failed: "Failed",
};

export const AUTOMATION_STATUS_TONE: Record<AutomationStatus, "success" | "neutral" | "info" | "critical"> = {
  active: "success",
  paused: "neutral",
  running: "info",
  failed: "critical",
};

export const AUTOMATION_RUN_LABEL: Record<AutomationRunStatus, string> = {
  success: "Succeeded",
  partial: "Completed with warnings",
  failed: "Failed",
  running: "In progress",
};

export const AUTOMATION_RUN_TONE: Record<AutomationRunStatus, "success" | "warning" | "critical" | "info"> = {
  success: "success",
  partial: "warning",
  failed: "critical",
  running: "info",
};

export const AUTOMATIONS_PAGE_SIZE = 8;

export type AccountScope = "business" | "agency";

/**
 * Automations visible to the current workspace.
 *
 * Business organizations only see automations for their own locations; agency
 * organizations see the whole portfolio, optionally narrowed to a client.
 */
export function getAutomations(
  accountType: AccountScope,
  activeClientId?: string | null,
  real?: AutomationsData | null,
): AutomationsData {
  return withDemoFallback(real, () => {
    const all = demoAutomations();
    const scoped = all.filter((automation) => {
      if (accountType === "business") return automation.clientId === "cl_riverside";
      if (activeClientId) return automation.clientId === activeClientId;
      return true;
    });
    return {
      status: scoped.length === 0 ? "no_automations" : "ready",
      automations: scoped,
      capabilities: {
        canCreate: true,
        canEdit: true,
        canPause: true,
        canRunNow: true,
        canDuplicate: true,
        canDelete: true,
        canViewHistory: true,
        availableTypes: [
          "rank_change_alert",
          "review_alert",
          "citation_monitor",
          "gbp_post_scheduler",
          "report_delivery",
        ],
      },
    };
  });
}

/** Short absolute date used across automation schedule columns. */
export function formatAutomationDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Create / edit workflow                                              */
/* ------------------------------------------------------------------ */

export type AutomationFrequency = "daily" | "weekly" | "monthly";

export const AUTOMATION_FREQUENCY_LABEL: Record<AutomationFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const DAYS_OF_WEEK = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
] as const;

export type AutomationParameter =
  | "recipients"
  | "rank_change_threshold"
  | "review_rating_threshold"
  | "report_type";

/**
 * Configuration surface each automation type accepts. Only these fields are
 * rendered by the create/edit form — nothing outside this map is offered.
 */
export type AutomationTypeConfig = {
  trigger: "recurring" | "event";
  /** What activates an event-based automation. Null for recurring types. */
  eventDescription: string | null;
  frequencies: AutomationFrequency[];
  supportsTimeOfDay: boolean;
  parameters: AutomationParameter[];
  /** Verb phrase used in the plain-language summary. */
  action: string;
};

export const AUTOMATION_TYPE_CONFIG: Record<AutomationType, AutomationTypeConfig> = {
  rank_change_alert: {
    trigger: "recurring",
    eventDescription: null,
    frequencies: ["daily", "weekly"],
    supportsTimeOfDay: true,
    parameters: ["rank_change_threshold", "recipients"],
    action: "Check tracked keyword positions and send a ranking change alert",
  },
  review_alert: {
    trigger: "event",
    eventDescription: "Runs as soon as a new review is published on the selected location's Google Business Profile.",
    frequencies: [],
    supportsTimeOfDay: false,
    parameters: ["review_rating_threshold", "recipients"],
    action: "Send a new review alert",
  },
  citation_monitor: {
    trigger: "recurring",
    eventDescription: null,
    frequencies: ["weekly", "monthly"],
    supportsTimeOfDay: true,
    parameters: ["recipients"],
    action: "Re-check directory listings and flag NAP inconsistencies",
  },
  gbp_post_scheduler: {
    trigger: "recurring",
    eventDescription: null,
    frequencies: ["weekly", "monthly"],
    supportsTimeOfDay: true,
    parameters: [],
    action: "Publish the next queued Google Business Profile post",
  },
  report_delivery: {
    trigger: "recurring",
    eventDescription: null,
    frequencies: ["weekly", "monthly"],
    supportsTimeOfDay: true,
    parameters: ["report_type", "recipients"],
    action: "Generate and email the selected report",
  },
};

export const AUTOMATION_REPORT_TYPES = [
  { value: "rank_tracker", label: "Rank Tracker" },
  { value: "gbp_audit", label: "GBP Audit" },
  { value: "competitor_analysis", label: "Competitor Analysis" },
  { value: "citation_report", label: "Citation Report" },
] as const;

export const REVIEW_RATING_THRESHOLDS = [
  { value: "all", label: "Every new review" },
  { value: "3", label: "Reviews rated 3 stars or lower" },
  { value: "2", label: "Reviews rated 2 stars or lower" },
] as const;

export type AutomationFormValues = {
  name: string;
  type: AutomationType | "";
  clientId: string;
  locationId: string;
  frequency: AutomationFrequency | "";
  dayOfWeek: string;
  dayOfMonth: string;
  timeOfDay: string;
  rankChangeThreshold: string;
  reviewRatingThreshold: string;
  reportType: string;
  recipients: string;
};

export type AutomationFormErrors = Partial<Record<keyof AutomationFormValues, string>>;

export function emptyAutomationForm(): AutomationFormValues {
  return {
    name: "",
    type: "",
    clientId: "",
    locationId: "",
    frequency: "",
    dayOfWeek: "2",
    dayOfMonth: "1",
    timeOfDay: "09:00",
    rankChangeThreshold: "3",
    reviewRatingThreshold: "all",
    reportType: "rank_tracker",
    recipients: "",
  };
}

/** Split a recipients textarea/input value into trimmed addresses. */
export function parseRecipients(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateAutomationForm(
  values: AutomationFormValues,
  options: { requireClient: boolean },
): AutomationFormErrors {
  const errors: AutomationFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Enter a name for this automation.";
  else if (name.length > 80) errors.name = "Use 80 characters or fewer.";

  if (!values.type) {
    errors.type = "Select an automation type.";
    return errors;
  }
  const config = AUTOMATION_TYPE_CONFIG[values.type];

  if (options.requireClient && !values.clientId) errors.clientId = "Select the client this automation belongs to.";
  if (!values.locationId) errors.locationId = "Select the location this automation runs for.";

  if (config.trigger === "recurring") {
    if (!values.frequency) errors.frequency = "Select how often this automation runs.";
    if (values.frequency === "monthly") {
      const day = Number(values.dayOfMonth);
      if (!Number.isInteger(day) || day < 1 || day > 28) errors.dayOfMonth = "Choose a day between 1 and 28.";
    }
    if (config.supportsTimeOfDay && !/^\d{2}:\d{2}$/.test(values.timeOfDay)) {
      errors.timeOfDay = "Enter a valid time.";
    }
  }

  if (config.parameters.includes("rank_change_threshold")) {
    const threshold = Number(values.rankChangeThreshold);
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 50) {
      errors.rankChangeThreshold = "Enter a position change between 1 and 50.";
    }
  }

  if (config.parameters.includes("report_type") && !values.reportType) {
    errors.reportType = "Select the report to deliver.";
  }

  if (config.parameters.includes("recipients")) {
    const recipients = parseRecipients(values.recipients);
    if (recipients.length === 0) errors.recipients = "Add at least one recipient email address.";
    else if (recipients.length > 10) errors.recipients = "Add 10 recipients or fewer.";
    else if (recipients.some((email) => !EMAIL_PATTERN.test(email) || email.length > 255)) {
      errors.recipients = "One or more email addresses are not valid.";
    }
  }

  return errors;
}

function ordinal(day: number): string {
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${suffix}`;
}

/** Human-readable cadence, e.g. "Weekly · Tuesdays at 09:00". */
export function describeSchedule(values: AutomationFormValues): string {
  if (!values.type) return "—";
  const config = AUTOMATION_TYPE_CONFIG[values.type];
  if (config.trigger === "event") return "Real-time";
  if (!values.frequency) return "—";
  const time = config.supportsTimeOfDay && values.timeOfDay ? ` at ${values.timeOfDay}` : "";
  if (values.frequency === "daily") return `Daily${time}`;
  if (values.frequency === "weekly") {
    const day = DAYS_OF_WEEK.find((d) => d.value === values.dayOfWeek)?.label ?? "Monday";
    return `Weekly · ${day}s${time}`;
  }
  const day = Number(values.dayOfMonth);
  return `Monthly · ${ordinal(Number.isFinite(day) ? day : 1)}${time}`;
}

/** Plain-language description of what the configured automation will do. */
export function buildAutomationSummary(
  values: AutomationFormValues,
  context: { locationName: string | null; clientName: string | null },
): string[] {
  if (!values.type) return [];
  const config = AUTOMATION_TYPE_CONFIG[values.type];
  const lines: string[] = [];
  const where = context.locationName ?? "the selected location";
  const client = context.clientName ? ` (${context.clientName})` : "";

  if (values.type === "rank_change_alert") {
    const threshold = values.rankChangeThreshold || "3";
    lines.push(`Check tracked keyword positions for ${where}${client} and alert when a keyword moves ${threshold} positions or more.`);
  } else if (values.type === "review_alert") {
    const scope =
      REVIEW_RATING_THRESHOLDS.find((r) => r.value === values.reviewRatingThreshold)?.label ?? "Every new review";
    lines.push(`${scope.toLowerCase() === "every new review" ? "Every new review" : scope} for ${where}${client} triggers an alert.`);
  } else if (values.type === "report_delivery") {
    const report = AUTOMATION_REPORT_TYPES.find((r) => r.value === values.reportType)?.label ?? "report";
    lines.push(`Generate the ${report} report for ${where}${client} and email it to the recipients below.`);
  } else {
    lines.push(`${config.action} for ${where}${client}.`);
  }

  lines.push(
    config.trigger === "event"
      ? config.eventDescription ?? "Runs when the triggering event occurs."
      : `Runs ${describeSchedule(values).toLowerCase()}.`,
  );

  if (config.parameters.includes("recipients")) {
    const recipients = parseRecipients(values.recipients);
    lines.push(
      recipients.length > 0
        ? `Notifies ${recipients.join(", ")}.`
        : "No recipients added yet.",
    );
  }
  return lines;
}

export type AutomationDetailStatus = "loading" | "ready" | "not_found" | "error";

export type AutomationDetail = {
  status: AutomationDetailStatus;
  automation: Automation | null;
  capabilities: AutomationsCapabilities;
};

/** Single automation for the edit workflow. Real payloads stay authoritative. */
export function getAutomationDetail(
  automationId: string,
  accountType: AccountScope,
  activeClientId?: string | null,
  real?: AutomationDetail | null,
): AutomationDetail {
  return withDemoFallback(real, () => {
    const list = getAutomations(accountType, activeClientId ?? null);
    const automation = list.automations.find((item) => item.id === automationId) ?? null;
    return {
      status: automation ? "ready" : "not_found",
      automation,
      capabilities: list.capabilities,
    };
  });
}

/** Map a stored automation back onto editable form values. */
export function formFromAutomation(automation: Automation): AutomationFormValues {
  const base = emptyAutomationForm();
  const frequency = automation.frequency ?? "";
  const lower = frequency.toLowerCase();
  const dayMatch = DAYS_OF_WEEK.find((d) => lower.includes(d.label.toLowerCase()));
  const monthDay = lower.match(/(\d{1,2})(st|nd|rd|th)/);
  const time = frequency.match(/(\d{2}:\d{2})/);
  return {
    ...base,
    name: automation.name,
    type: automation.type,
    clientId: automation.clientId ?? "",
    locationId: automation.locationId ?? "",
    frequency: lower.startsWith("daily")
      ? "daily"
      : lower.startsWith("weekly")
        ? "weekly"
        : lower.startsWith("monthly")
          ? "monthly"
          : AUTOMATION_TYPE_CONFIG[automation.type].frequencies[0] ?? "",
    dayOfWeek: dayMatch?.value ?? base.dayOfWeek,
    dayOfMonth: monthDay?.[1] ?? base.dayOfMonth,
    timeOfDay: time?.[1] ?? base.timeOfDay,
  };
}
