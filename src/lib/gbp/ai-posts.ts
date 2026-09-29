import { useSyncExternalStore } from "react";
import { addDays, addMonths, format, isAfter, setHours, setMinutes, startOfDay } from "date-fns";
import type { StatusTone } from "@/components/layout/shared/data-display";
import { demoAiGbpPosts, demoAiPostCopy, demoAiPostImage } from "../mypageseo/demo/ai-posts";

/* -------------------------------------------------------------------------- */
/* Contract                                                                   */
/* -------------------------------------------------------------------------- */

export type AiPostStatus = "draft" | "pending_approval" | "scheduled" | "published" | "failed";

export type AiPostType = "whats_new" | "offer" | "event" | "product";

export type AiPostCta = "book" | "order_online" | "learn_more" | "call_now" | "sign_up" | "none";

export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

export type RecurrenceFrequency = "none" | "daily" | "twice_weekly" | "weekly" | "monthly" | "custom";

/** Weekday index, 0 = Monday … 6 = Sunday (matches the calendar grid). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type AiGbpPost = {
  id: string;
  locationId: string;
  businessName: string;
  topic: string;
  title: string;
  content: string;
  type: AiPostType;
  cta: AiPostCta;
  imageUrl: string | null;
  imageSource: "ai" | "upload" | null;
  aiGenerated: boolean;
  status: AiPostStatus;
  approvalStatus: ApprovalStatus;
  /** ISO timestamp the post is (or was) scheduled to go live. */
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  recurrence: RecurrenceFrequency;
  recurrenceDays: Weekday[];
  failureReason: string | null;
};

export type PublishingScheduleFrequency = Exclude<RecurrenceFrequency, "none">;

export type PublishingScheduleSetting = {
  frequency: PublishingScheduleFrequency;
  /** Weekly, twice-a-week and custom schedules publish on these weekdays. */
  days: Weekday[];
  /** Monthly schedules publish on this day of the month (1-28). */
  dayOfMonth: number;
  /** 24h "HH:mm". */
  time: string;
};

/* -------------------------------------------------------------------------- */
/* Labels                                                                     */
/* -------------------------------------------------------------------------- */

export const AI_POST_STATUS_LABEL: Record<AiPostStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
};

/** Short labels for the dense calendar grid. */
export const AI_POST_STATUS_SHORT_LABEL: Record<AiPostStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
};

export const AI_POST_STATUS_TONE: Record<AiPostStatus, StatusTone> = {
  draft: "neutral",
  pending_approval: "warning",
  scheduled: "info",
  published: "success",
  failed: "critical",
};

/** Solid dot colours used where a full badge doesn't fit. */
export const AI_POST_STATUS_DOT: Record<AiPostStatus, string> = {
  draft: "bg-muted-foreground/50",
  pending_approval: "bg-warning",
  scheduled: "bg-info",
  published: "bg-success",
  failed: "bg-critical",
};

export const AI_POST_TYPE_LABEL: Record<AiPostType, string> = {
  whats_new: "What's New",
  offer: "Offer",
  event: "Event",
  product: "Product",
};

export const AI_POST_CTA_LABEL: Record<AiPostCta, string> = {
  book: "Book",
  order_online: "Order Online",
  learn_more: "Learn More",
  call_now: "Call Now",
  sign_up: "Sign Up",
  none: "None",
};

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  not_required: "Not required",
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const APPROVAL_STATUS_TONE: Record<ApprovalStatus, StatusTone> = {
  not_required: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "critical",
};

export const RECURRENCE_LABEL: Record<RecurrenceFrequency, string> = {
  none: "None",
  daily: "Daily",
  twice_weekly: "Twice a Week",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: "Mon",
  1: "Tue",
  2: "Wed",
  3: "Thu",
  4: "Fri",
  5: "Sat",
  6: "Sun",
};

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Google Business Profile post body limit. */
export const GBP_POST_MAX_CHARS = 1500;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Monday-based weekday index for a date. */
export function weekdayOf(date: Date): Weekday {
  return ((date.getDay() + 6) % 7) as Weekday;
}

export function formatTime24(time: string): string {
  const [h = "0", m = "0"] = time.split(":");
  return format(setMinutes(setHours(new Date(), Number(h)), Number(m)), "h:mm a");
}

/** Combines a calendar date and "HH:mm" into a Date. */
export function combineDateTime(date: Date, time: string): Date {
  const [h = "0", m = "0"] = time.split(":");
  return setMinutes(setHours(startOfDay(date), Number(h)), Number(m));
}

export function describeSchedule(setting: PublishingScheduleSetting): string {
  const at = `at ${formatTime24(setting.time)}`;
  const days = [...setting.days].sort().map((d) => WEEKDAY_SHORT[d]).join(", ");
  switch (setting.frequency) {
    case "daily":
      return `Every day ${at}`;
    case "twice_weekly":
      return `Twice a week on ${days} ${at}`;
    case "weekly":
      return `Every ${days} ${at}`;
    case "monthly":
      return `Monthly on day ${setting.dayOfMonth} ${at}`;
    case "custom":
      return days ? `Every ${days} ${at}` : "No publishing days selected";
  }
}

/** Next publishing slot after `from` for a schedule, or null if it can't run. */
export function nextScheduleSlot(setting: PublishingScheduleSetting, from = new Date()): Date | null {
  if (setting.frequency === "monthly") {
    for (let i = 0; i < 2; i++) {
      const month = addMonths(from, i);
      const slot = combineDateTime(new Date(month.getFullYear(), month.getMonth(), setting.dayOfMonth), setting.time);
      if (isAfter(slot, from)) return slot;
    }
    return null;
  }
  const days = setting.frequency === "daily" ? WEEKDAYS : setting.days;
  if (days.length === 0) return null;
  for (let i = 0; i < 8; i++) {
    const day = addDays(from, i);
    const slot = combineDateTime(day, setting.time);
    if (days.includes(weekdayOf(day)) && isAfter(slot, from)) return slot;
  }
  return null;
}

/** Which actions make sense for a post in its current state. */
export function postActions(post: AiGbpPost) {
  const live = post.status === "published";
  return {
    canEdit: !live,
    canApprove: post.status === "pending_approval",
    canReschedule: !live,
    canDuplicate: true,
    canDelete: true,
    canRetry: post.status === "failed",
  };
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/*                                                                            */
/* The posting backend is not connected yet, so posts live in a frontend-only */
/* store seeded with demo data. Swap the body of these actions for backend    */
/* mutations when the integration is available; components only use the      */
/* hook and the actions below.                                                */
/* -------------------------------------------------------------------------- */

type AiPostsState = {
  status: "loading" | "ready";
  posts: AiGbpPost[];
  schedule: PublishingScheduleSetting;
};

const DEFAULT_SCHEDULE: PublishingScheduleSetting = {
  frequency: "twice_weekly",
  days: [1, 4],
  dayOfMonth: 1,
  time: "10:00",
};

let state: AiPostsState = { status: "loading", posts: [], schedule: DEFAULT_SCHEDULE };
let started = false;
const listeners = new Set<() => void>();

function setState(update: (current: AiPostsState) => AiPostsState) {
  state = update(state);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    // Simulates the first fetch so loading states are exercised.
    window.setTimeout(() => setState((s) => ({ ...s, status: "ready", posts: demoAiGbpPosts() })), 650);
  }
  return () => listeners.delete(listener);
}

export function useAiPostsStore(): AiPostsState {
  return useSyncExternalStore(subscribe, () => state);
}

function newId() {
  return `aipost_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function patch(id: string, update: (post: AiGbpPost) => Partial<AiGbpPost>) {
  setState((s) => ({ ...s, posts: s.posts.map((p) => (p.id === id ? { ...p, ...update(p) } : p)) }));
}

export type AiPostInput = Omit<AiGbpPost, "id" | "createdAt" | "publishedAt" | "failureReason">;

export const aiPostsActions = {
  create(input: AiPostInput): AiGbpPost {
    const now = new Date().toISOString();
    const post: AiGbpPost = {
      ...input,
      id: newId(),
      createdAt: now,
      publishedAt: input.status === "published" ? now : null,
      failureReason: null,
    };
    setState((s) => ({ ...s, posts: [...s.posts, post] }));
    return post;
  },
  update(id: string, input: AiPostInput) {
    patch(id, () => ({
      ...input,
      failureReason: null,
      publishedAt: input.status === "published" ? new Date().toISOString() : null,
    }));
  },
  remove(id: string) {
    setState((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id) }));
  },
  duplicate(id: string): AiGbpPost | null {
    const source = state.posts.find((p) => p.id === id);
    if (!source) return null;
    const copy: AiGbpPost = {
      ...source,
      id: newId(),
      title: `${source.title} (copy)`,
      status: "draft",
      approvalStatus: source.approvalStatus === "not_required" ? "not_required" : "pending",
      scheduledAt: null,
      publishedAt: null,
      failureReason: null,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, posts: [...s.posts, copy] }));
    return copy;
  },
  /** Approves a pending post; it is scheduled, or published if its slot has passed. */
  approve(id: string): AiPostStatus {
    const post = state.posts.find((p) => p.id === id);
    const future = post?.scheduledAt ? isAfter(new Date(post.scheduledAt), new Date()) : false;
    const status: AiPostStatus = future ? "scheduled" : "published";
    patch(id, () => ({
      status,
      approvalStatus: "approved",
      publishedAt: status === "published" ? new Date().toISOString() : null,
    }));
    return status;
  },
  reject(id: string) {
    patch(id, () => ({ status: "draft", approvalStatus: "rejected" }));
  },
  reschedule(id: string, when: Date) {
    patch(id, (p) => ({
      scheduledAt: when.toISOString(),
      status: p.status === "pending_approval" ? "pending_approval" : "scheduled",
      failureReason: null,
    }));
  },
  retry(id: string) {
    patch(id, () => ({ status: "published", failureReason: null, publishedAt: new Date().toISOString() }));
  },
  setSchedule(schedule: PublishingScheduleSetting) {
    setState((s) => ({ ...s, schedule }));
  },
};

/* -------------------------------------------------------------------------- */
/* AI generation (simulated)                                                  */
/* -------------------------------------------------------------------------- */

export type AiCopyRequest = {
  topic: string;
  type: AiPostType;
  businessName: string;
  area: string;
  tone: AiTone;
  /** Increments on regenerate to get a different variant. */
  variant: number;
};

export type AiTone = "friendly" | "professional" | "promotional";

export const AI_TONE_LABEL: Record<AiTone, string> = {
  friendly: "Friendly",
  professional: "Professional",
  promotional: "Promotional",
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function generateAiPostCopy(request: AiCopyRequest): Promise<{ title: string; content: string }> {
  await wait(1400);
  return demoAiPostCopy(request);
}

export async function generateAiPostImage(topic: string, variant: number): Promise<string> {
  await wait(1800);
  return demoAiPostImage(topic, variant);
}
