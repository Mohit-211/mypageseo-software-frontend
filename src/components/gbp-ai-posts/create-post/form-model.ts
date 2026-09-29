import { isAfter } from "date-fns";
import {
  combineDateTime,
  GBP_POST_MAX_CHARS,
  type AiGbpPost,
  type AiPostCta,
  type AiPostInput,
  type AiPostType,
  type AiTone,
  type RecurrenceFrequency,
  type Weekday,
} from "@/lib/gbp/ai-posts";

export type CreatePostForm = {
  locationId: string;
  topic: string;
  type: AiPostType;
  cta: AiPostCta;
  tone: AiTone;
  title: string;
  content: string;
  aiGenerated: boolean;
  imageUrl: string | null;
  imageSource: "ai" | "upload" | null;
  publishMode: "now" | "later";
  date: Date | null;
  time: string;
  recurrence: RecurrenceFrequency;
  recurrenceDays: Weekday[];
  requireApproval: boolean;
};

export type CreatePostErrors = Partial<Record<"locationId" | "topic" | "title" | "content" | "date" | "recurrenceDays", string>>;

export type FormSectionProps = {
  form: CreatePostForm;
  onChange: (patch: Partial<CreatePostForm>) => void;
  errors: CreatePostErrors;
};

export function emptyCreatePostForm(overrides: Partial<CreatePostForm> = {}): CreatePostForm {
  return {
    locationId: "",
    topic: "",
    type: "whats_new",
    cta: "learn_more",
    tone: "friendly",
    title: "",
    content: "",
    aiGenerated: false,
    imageUrl: null,
    imageSource: null,
    publishMode: "later",
    date: null,
    time: "10:00",
    recurrence: "none",
    recurrenceDays: [],
    requireApproval: true,
    ...overrides,
  };
}

export function formFromPost(post: AiGbpPost): CreatePostForm {
  const scheduled = post.scheduledAt ? new Date(post.scheduledAt) : null;
  const future = scheduled ? isAfter(scheduled, new Date()) : false;
  return emptyCreatePostForm({
    locationId: post.locationId,
    topic: post.topic,
    type: post.type,
    cta: post.cta,
    title: post.title,
    content: post.content,
    aiGenerated: post.aiGenerated,
    imageUrl: post.imageUrl,
    imageSource: post.imageSource,
    publishMode: "later",
    date: future ? scheduled : null,
    time: scheduled
      ? `${String(scheduled.getHours()).padStart(2, "0")}:${String(scheduled.getMinutes()).padStart(2, "0")}`
      : "10:00",
    recurrence: post.recurrence,
    recurrenceDays: post.recurrenceDays,
    requireApproval: post.approvalStatus !== "not_required",
  });
}

export function scheduledDate(form: CreatePostForm): Date | null {
  return form.date ? combineDateTime(form.date, form.time) : null;
}

/** Validation for scheduling/publishing. Drafts only need a profile and something to save. */
export function validateForPublish(form: CreatePostForm): CreatePostErrors {
  const errors: CreatePostErrors = {};
  if (!form.locationId) errors.locationId = "Choose a business profile.";
  if (!form.title.trim()) errors.title = "Add a post title.";
  if (!form.content.trim()) errors.content = "Generate the post text with AI or write it yourself.";
  else if (form.content.length > GBP_POST_MAX_CHARS) errors.content = `Keep the post under ${GBP_POST_MAX_CHARS.toLocaleString()} characters.`;
  if (form.publishMode === "later") {
    const when = scheduledDate(form);
    if (!when) errors.date = "Choose a publish date.";
    else if (!isAfter(when, new Date())) errors.date = "Choose a date and time in the future.";
  }
  if (form.recurrence === "twice_weekly" && form.recurrenceDays.length !== 2) errors.recurrenceDays = "Choose exactly two days.";
  if (form.recurrence === "custom" && form.recurrenceDays.length === 0) errors.recurrenceDays = "Choose at least one day.";
  return errors;
}

export function validateForDraft(form: CreatePostForm): CreatePostErrors {
  const errors: CreatePostErrors = {};
  if (!form.locationId) errors.locationId = "Choose a business profile.";
  if (!form.topic.trim() && !form.title.trim() && !form.content.trim()) errors.topic = "Add a topic or some post text before saving.";
  return errors;
}

export function toPostInput(
  form: CreatePostForm,
  businessName: string,
  intent: "draft" | "submit",
): AiPostInput {
  const when = form.publishMode === "now" ? new Date() : scheduledDate(form);
  const status =
    intent === "draft"
      ? "draft"
      : form.requireApproval
        ? "pending_approval"
        : form.publishMode === "now"
          ? "published"
          : "scheduled";
  return {
    locationId: form.locationId,
    businessName,
    topic: form.topic.trim(),
    title: form.title.trim() || form.topic.trim() || "Untitled post",
    content: form.content,
    type: form.type,
    cta: form.cta,
    imageUrl: form.imageUrl,
    imageSource: form.imageSource,
    aiGenerated: form.aiGenerated,
    status,
    approvalStatus: form.requireApproval ? "pending" : "not_required",
    scheduledAt: when ? when.toISOString() : null,
    recurrence: form.recurrence,
    recurrenceDays: form.recurrence === "custom" || form.recurrence === "twice_weekly" ? form.recurrenceDays : [],
  };
}

/** Toasts on the create form open at the top so they never cover the sticky action bar. */
export const FORM_TOAST = { position: "top-center" } as const;
