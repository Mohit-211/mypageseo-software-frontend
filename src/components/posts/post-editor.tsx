import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus, LoaderCircle, Sparkles, Trash2, Upload, X } from "lucide-react";
import {
  aiPostImage,
  createPost,
  deletePostMedia,
  validatePost,
  runPostAction,
  schedulePost,
  updatePost,
  uploadPostMedia,
  type AiImageStyle,
  type CtaType,
  type Post,
  type PostInput,
  type PostIssue,
  type PostMedia,
  type PostRecurrence,
  type PostsSummary,
  type PostType,
  type WeekOfMonth,
  type Weekday,
} from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import { useAiStatus } from "@/lib/ai/ai-status";
import type { PostSeed } from "@/lib/posts/post-seed";
import { useToastPostError } from "@/lib/posts/post-toasts";
import {
  CTA_LABEL,
  STOCK_ART_STYLES,
  STYLE_LABEL,
  STYLE_ORDER,
  WEEKDAYS,
  postFailureText,
  postsKey,
  useInvalidatePosts,
  usePostMedia,
} from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";
import { AiWriter } from "./ai-writer";

const SUMMARY_MAX = 1500;
const TITLE_MAX = 58;
const NO_CTA = "none";

type Form = {
  type: PostType;
  summary: string;
  ctaType: CtaType | typeof NO_CTA;
  ctaUrl: string;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  coupon: string;
  redeemUrl: string;
  terms: string;
  repeats: boolean;
  pattern: PostRecurrence["pattern"];
  days: Weekday[];
  monthlyBy: "day" | "week";
  dayOfMonth: string;
  weekOfMonth: WeekOfMonth;
  endsOn: string;
  media: PostMedia | null;
  source: "manual" | "ai";
};

function fromPost(post: Post | null, defaults: PostsSummary["settings"]): Form {
  return {
    type: post?.type ?? "standard",
    summary: post?.summary ?? "",
    ctaType: post ? (post.cta?.type ?? NO_CTA) : (defaults.default_cta?.type ?? NO_CTA),
    ctaUrl: post ? (post.cta?.url ?? "") : (defaults.default_cta?.url ?? ""),
    title: post?.event?.title ?? "",
    startDate: post?.event?.start.date ?? "",
    startTime: post?.event?.start.time ?? "",
    endDate: post?.event?.end.date ?? "",
    endTime: post?.event?.end.time ?? "",
    coupon: post?.offer?.coupon_code ?? "",
    redeemUrl: post?.offer?.redeem_url ?? "",
    terms: post?.offer?.terms ?? "",
    repeats: Boolean(post?.recurrence),
    pattern: post?.recurrence?.pattern ?? "weekly",
    days: post?.recurrence?.days_of_week ?? [],
    monthlyBy: post?.recurrence?.week_of_month ? "week" : "day",
    dayOfMonth: post?.recurrence?.day_of_month ? String(post.recurrence.day_of_month) : "",
    weekOfMonth: post?.recurrence?.week_of_month ?? "FIRST",
    endsOn: post?.recurrence?.ends_on ?? "",
    media: post?.media[0] ?? null,
    source: post?.source === "ai" ? "ai" : "manual",
  };
}

/** A new post's form, filled from an AI draft (the writer on AI Posts hands it over). */
function fromSeed(seed: PostSeed, defaults: PostsSummary["settings"]): Form {
  const base = fromPost(null, defaults);
  return {
    ...base,
    type: seed.type,
    summary: seed.draft.summary,
    title: seed.draft.event_title ?? "",
    // Offers have no button (Google shows its own "View offer").
    ctaType: seed.type !== "offer" && seed.draft.cta_type ? seed.draft.cta_type : base.ctaType,
    source: "ai",
  };
}

function toInput(form: Form): PostInput {
  const dated = form.type !== "standard";
  return {
    type: form.type,
    summary: form.summary.trim() || null,
    // Offers have no button: Google shows its own "View offer".
    cta: form.type === "offer" || form.ctaType === NO_CTA ? null : { type: form.ctaType, url: form.ctaType === "CALL" ? null : form.ctaUrl.trim() || null },
    event: dated
      ? {
          title: form.title.trim(),
          start: { date: form.startDate, ...(form.startTime ? { time: form.startTime } : {}) },
          end: { date: form.endDate, ...(form.endTime ? { time: form.endTime } : {}) },
        }
      : null,
    offer: form.type === "offer" ? { coupon_code: form.coupon.trim() || null, redeem_url: form.redeemUrl.trim() || null, terms: form.terms.trim() || null } : null,
    recurrence:
      dated && form.repeats && form.endsOn
        ? {
            pattern: form.pattern,
            days_of_week: form.pattern === "weekly" ? form.days : null,
            day_of_month: form.pattern === "monthly" && form.monthlyBy === "day" && form.dayOfMonth ? Number(form.dayOfMonth) : null,
            week_of_month: form.pattern === "monthly" && form.monthlyBy === "week" ? form.weekOfMonth : null,
            ends_on: form.endsOn,
          }
        : null,
    media_ids: form.media ? [form.media.media_id] : [],
    source: form.source,
  };
}

/** Only the fields that differ from the saved post (a post on Google is patched with exactly these). */
function changedFields(input: PostInput, post: Post): PostInput {
  const before = toInput(fromPost(post, { approval: "off", default_cta: null, language_code: "en" }));
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(input) as (keyof PostInput)[]) {
    if (JSON.stringify(input[key] ?? null) !== JSON.stringify(before[key] ?? null)) patch[key] = input[key];
  }
  return patch as PostInput;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A moment as a local `datetime-local` value ("2026-11-14T09:30"). */
function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A local `datetime-local` value two hours from now, rounded to the quarter hour. */
function defaultScheduleValue(): string {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return localInputValue(date);
}

/**
 * The times the "Schedule for" picker offers: from this minute to a year ahead, as the backend
 * accepts (2 minutes to 366 days ahead; it still checks the exact time). The max also stops
 * Chrome's year segment at 4 digits.
 */
function scheduleRangeFromNow(): { min: string; max: string } {
  const now = Date.now();
  return { min: localInputValue(new Date(now)), max: localInputValue(new Date(now + 365 * DAY_MS)) };
}

/**
 * The "Schedule for" value as an ISO instant, or null when it isn't a real date and time.
 * Chrome's year segment takes up to 6 digits, and `new Date("20266-…").toISOString()` throws, which
 * used to take the whole Posts page (and the unsaved post) down while someone was still typing.
 */
const toScheduleIso = (value: string): string | null => {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

/**
 * Create or edit a post. Issues (what blocks publishing) and warnings come from the
 * backend on every saved post; a draft may be incomplete.
 *
 * `seed` starts a new post from an AI draft (AI Posts); `aiOpen` opens the AI writer straight away.
 */
export function PostEditor({
  locationId,
  post,
  summary,
  onClose,
  seed,
  aiOpen = false,
}: {
  locationId: string;
  post: Post | null;
  summary: PostsSummary;
  onClose: () => void;
  seed?: PostSeed | null;
  aiOpen?: boolean;
}) {
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
  const [saved, setSaved] = useState<Post | null>(post);
  const [form, setForm] = useState<Form>(() => (!post && seed ? fromSeed(seed, summary.settings) : fromPost(post, summary.settings)));
  const [scheduleAt, setScheduleAt] = useState(() => (post?.scheduled_at ? localInputValue(new Date(post.scheduled_at)) : defaultScheduleValue()));
  // Read once when the editor opens (never during render).
  const [scheduleRange] = useState(scheduleRangeFromNow);
  const [busy, setBusy] = useState<string | null>(null);
  const [savedIssues, setIssues] = useState<PostIssue[]>(post?.issues ?? []);
  const [savedWarnings, setWarnings] = useState(post?.warnings ?? []);
  const [imageIdea, setImageIdea] = useState(() => (!post && seed?.draft.image_idea) || "");
  // A brand-new, empty post doesn't open with red errors: issues show once something is written (or a save fails).
  const [touched, setTouched] = useState(Boolean(post || seed));
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setTouched(true);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onGoogle = saved?.status === "published" || saved?.status === "rejected";
  const needsApproval = summary.you.needs_approval;
  // Null while the field is empty or holds an impossible date (e.g. a 5-digit year mid-typing).
  const scheduleIso = !onGoogle && scheduleAt ? toScheduleIso(scheduleAt) : null;
  const scheduleInvalid = !onGoogle && scheduleAt !== "" && scheduleIso === null;
  // Live check while typing (`POST posts/validate`): the full current content, nothing saved.
  const draftInput = { ...toInput(form), type: form.type, ...(scheduleIso ? { scheduled_at: scheduleIso } : {}) };
  const debouncedInput = useDebounced(JSON.stringify(draftInput), 600);
  const validation = useQuery({
    queryKey: [...postsKey(locationId), "validate", debouncedInput],
    queryFn: ({ signal }) => validatePost(locationId, JSON.parse(debouncedInput) as typeof draftInput, signal),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    retry: false,
  });
  const issues = validation.data?.issues ?? savedIssues;
  const warnings = validation.data?.warnings ?? savedWarnings;
  // A schedule-time problem blocks Schedule, not Publish now.
  const incomplete = validation.data ? !validation.data.complete : false;
  const blocksPublish = issues.some((issue) => issue.field !== "scheduled_at");
  // Hotels and lodging (Phase 22): validate answers `offer_not_allowed_for_lodging` for an Offer post.
  const lodging = issues.some((issue) => issue.code === "offer_not_allowed_for_lodging");
  const shownIssues = touched ? issues : [];
  const shownWarnings = touched ? warnings : [];
  const issueFor = (field: string) => shownIssues.filter((issue) => issue.field === field || issue.field.startsWith(`${field}.`));
  // A time problem shows under "Schedule for" (it blocks Schedule, not Publish now); the box above
  // the field lists only what blocks publishing.
  const scheduleIssues: PostIssue[] = scheduleInvalid
    ? [{ field: "scheduled_at", code: "invalid_datetime", message: "Enter a valid date and time." }]
    : issueFor("scheduled_at");
  const publishIssues = shownIssues.filter((issue) => issue.field !== "scheduled_at");
  // A link problem shows under "Button link" while that field is there, not twice.
  const linkShown = form.type !== "offer" && form.ctaType !== NO_CTA && form.ctaType !== "CALL";
  const ctaIssues = issueFor("cta").filter((issue) => !(linkShown && issue.field.startsWith("cta.url")));
  const contentBlocked = validation.data !== undefined && blocksPublish;
  // Why Schedule or Publish is off, in words next to the buttons (a title can't be read on touch screens).
  const actionVerb = needsApproval ? "send it for approval" : "schedule or publish it";
  const blockedReasons = [
    contentBlocked ? (touched ? `Fix the issues above to ${actionVerb}.` : `Write your post to ${actionVerb}.`) : null,
    !onGoogle && !scheduleIso
      ? scheduleInvalid
        ? "Enter a valid date and time to schedule."
        : "Pick a date and time to schedule."
      : !onGoogle && incomplete && !blocksPublish
        ? "Pick another time to schedule."
        : null,
    !onGoogle && !summary.connection.gbp_connected ? "Connect Google to publish." : null,
  ].filter((reason): reason is string => reason !== null);
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  const fail = (err: unknown, fallback: string) => {
    const data = (err as { details?: { data?: { issues?: PostIssue[] } } })?.details?.data;
    if (data?.issues) setIssues(data.issues);
    setTouched(true);
    toastError(err, fallback, {
      onReload: () => {
        invalidate();
        onClose();
      },
    });
  };

  /** Saves the form (create as a draft, or PATCH the changes) and returns the saved post. */
  const save = async (): Promise<Post> => {
    const input = toInput(form);
    const result = saved ? await updatePost(locationId, saved.post_id, changedFields(input, saved)) : await createPost(locationId, { ...input, action: "draft" });
    setSaved(result);
    setIssues(result.issues);
    setWarnings(result.warnings);
    return result;
  };

  const run = async (key: string, action: () => Promise<Post | void>, done: (post: Post | void) => string) => {
    setBusy(key);
    try {
      const result = await action();
      invalidate();
      toast.success(done(result));
      if (result && (result.status === "failed" || result.status === "rejected")) {
        toast.error(postFailureText(result.error) ?? "Google didn't accept the post.", { description: "The post is kept; fix it and try again." });
      }
      if (key !== "save" || !result || result.issues.length === 0) onClose();
    } catch (err) {
      fail(err, "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const outcome = (result: Post | void) =>
    !result
      ? "Saved."
      : result.status === "pending_approval"
        ? "Sent for approval."
        : result.status === "scheduled"
          ? "Scheduled."
          : result.status === "published"
            ? "Published on Google."
            : result.status === "draft"
              ? "Draft saved."
              : "Saved.";

  const doSchedule = async () => {
    const at = scheduleIso;
    if (!at) return;
    await run("schedule", async () => {
      if (!saved) return createPost(locationId, { ...toInput(form), action: "schedule", scheduled_at: at });
      await save();
      return schedulePost(locationId, saved.post_id, at);
    }, outcome);
  };
  const doPublish = () =>
    run("publish", async () => {
      if (!saved) return createPost(locationId, { ...toInput(form), action: "publish" });
      await save();
      return runPostAction(locationId, saved.post_id, "publish");
    }, outcome);

  return (
    <Dialog open onOpenChange={(open) => (open || busy ? undefined : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {saved ? "Edit post" : seed ? "New post from AI" : "New post"}
            {!saved && seed ? (
              <StatusBadge tone="ai" icon={Sparkles} size="sm">
                AI draft
              </StatusBadge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {onGoogle
              ? "This post is on Google: saving updates it there (only the changed fields)."
              : seed && !saved
                ? "Read it through and make it yours, add a photo, then save, schedule or publish."
                : "Write the post, then save it as a draft, schedule it or publish it now."}
          </DialogDescription>
        </DialogHeader>

        {!summary.connection.gbp_connected ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            Connect this location to Google to publish. You can still write and save drafts.
          </p>
        ) : null}

        <div className="space-y-5">
          <Field label="Post type" labelId={fieldId("type-label")}>
            <div role="group" aria-labelledby={fieldId("type-label")} className="flex flex-wrap gap-2">
              {(["standard", "event", "offer"] as const).map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant={form.type === type ? "default" : "outline"}
                  disabled={(onGoogle && form.type !== type) || (type === "offer" && lodging && form.type !== "offer")}
                  title={
                    onGoogle && form.type !== type
                      ? "A published post's type can't change; duplicate it instead"
                      : type === "offer" && lodging
                        ? "Google doesn't allow Offer posts for hotels and lodging"
                        : undefined
                  }
                  onClick={() => set("type", type)}
                >
                  {type === "standard" ? "Update" : type === "event" ? "Event" : "Offer"}
                </Button>
              ))}
            </div>
            {lodging ? (
              <p className="text-xs text-warning-foreground">Google doesn't allow Offer posts for hotels and other lodging. Use an Update or Event post instead.</p>
            ) : null}
          </Field>

          <AiWriter
            locationId={locationId}
            defaultOpen={aiOpen}
            type={form.type}
            lodging={lodging}
            onTypeChange={(type) => {
              if (!onGoogle) set("type", type);
            }}
            onPick={(draft) => {
              setTouched(true);
              setForm((current) => ({
                ...current,
                summary: draft.summary,
                title: draft.event_title ?? current.title,
                ctaType: draft.cta_type && current.type !== "offer" ? draft.cta_type : current.ctaType,
                source: "ai",
              }));
              if (draft.image_idea) setImageIdea(draft.image_idea);
            }}
          />

          {form.type !== "standard" ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Field label={`${form.type === "event" ? "Event" : "Offer"} title`} htmlFor={fieldId("title")} issues={issueFor("event.title")}>
                <Input
                  {...fieldProps(fieldId("title"), issueFor("event.title"), fieldId("title-count"))}
                  value={form.title}
                  maxLength={TITLE_MAX}
                  onChange={(event) => set("title", event.target.value)}
                />
                <Counter id={fieldId("title-count")} value={form.title.length} max={TITLE_MAX} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Starts" htmlFor={fieldId("start")} issues={issueFor("event.start")}>
                  <div className="flex gap-2">
                    <Input type="date" {...fieldProps(fieldId("start"), issueFor("event.start"))} value={form.startDate} onChange={(event) => set("startDate", event.target.value)} />
                    <Input
                      type="time"
                      aria-label="Start time (optional)"
                      aria-describedby={issueFor("event.start").length ? issuesId(fieldId("start")) : undefined}
                      value={form.startTime}
                      onChange={(event) => set("startTime", event.target.value)}
                    />
                  </div>
                </Field>
                <Field label="Ends" htmlFor={fieldId("end")} issues={issueFor("event.end")}>
                  <div className="flex gap-2">
                    <Input type="date" {...fieldProps(fieldId("end"), issueFor("event.end"))} value={form.endDate} onChange={(event) => set("endDate", event.target.value)} />
                    <Input
                      type="time"
                      aria-label="End time (optional)"
                      aria-describedby={issueFor("event.end").length ? issuesId(fieldId("end")) : undefined}
                      value={form.endTime}
                      onChange={(event) => set("endTime", event.target.value)}
                    />
                  </div>
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">Dates are the location's local dates. Without a time, it covers the whole day.</p>
              <RecurrenceFields form={form} set={set} issues={issueFor("recurrence")} />
            </div>
          ) : null}

          <Field label="Text" htmlFor={fieldId("summary")} issues={issueFor("summary")}>
            <Textarea
              {...fieldProps(fieldId("summary"), issueFor("summary"), fieldId("summary-count"))}
              rows={6}
              maxLength={SUMMARY_MAX}
              value={form.summary}
              onChange={(event) => set("summary", event.target.value)}
            />
            <Counter id={fieldId("summary-count")} value={form.summary.length} max={SUMMARY_MAX} />
          </Field>

          {form.type === "offer" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Coupon code (optional)" htmlFor={fieldId("coupon")} issues={issueFor("offer.coupon_code")}>
                <Input {...fieldProps(fieldId("coupon"), issueFor("offer.coupon_code"))} value={form.coupon} onChange={(event) => set("coupon", event.target.value)} />
              </Field>
              <Field label="Redeem online (optional, https)" htmlFor={fieldId("redeem")} issues={issueFor("offer.redeem_url")}>
                <Input
                  type="url"
                  {...fieldProps(fieldId("redeem"), issueFor("offer.redeem_url"))}
                  value={form.redeemUrl}
                  onChange={(event) => set("redeemUrl", event.target.value)}
                />
              </Field>
              <Field label="Terms (optional)" htmlFor={fieldId("terms")} className="sm:col-span-2" issues={issueFor("offer.terms")}>
                <Textarea rows={2} {...fieldProps(fieldId("terms"), issueFor("offer.terms"))} value={form.terms} onChange={(event) => set("terms", event.target.value)} />
              </Field>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
              <Field label="Button" htmlFor={fieldId("cta")} issues={ctaIssues}>
                <Select value={form.ctaType} onValueChange={(value) => set("ctaType", value as Form["ctaType"])}>
                  <SelectTrigger aria-label="Button" {...fieldProps(fieldId("cta"), ctaIssues)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CTA}>No button</SelectItem>
                    {(Object.keys(CTA_LABEL) as CtaType[]).map((type) => (
                      <SelectItem key={type} value={type}>{CTA_LABEL[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {form.ctaType !== NO_CTA && form.ctaType !== "CALL" ? (
                <Field label="Button link (https)" htmlFor={fieldId("cta-url")} issues={issueFor("cta.url")}>
                  <Input
                    type="url"
                    placeholder="https://"
                    {...fieldProps(fieldId("cta-url"), issueFor("cta.url"))}
                    value={form.ctaUrl}
                    onChange={(event) => set("ctaUrl", event.target.value)}
                  />
                </Field>
              ) : form.ctaType === "CALL" ? (
                <p className="self-end pb-2 text-xs text-muted-foreground">Calls the phone number on your Business Profile.</p>
              ) : null}
            </div>
          )}

          <PhotoField
            locationId={locationId}
            media={form.media}
            onChange={(media) => set("media", media)}
            photosPublishable={summary.connection.photos_publishable}
            imageIdea={imageIdea}
            issues={issueFor("media")}
          />

          {publishIssues.length > 0 ? (
            <div role="alert" className="rounded-lg border border-critical/25 bg-critical-surface px-3 py-2.5 text-sm text-critical">
              <p className="font-semibold">Before it can publish</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {publishIssues.map((issue) => (
                  <li key={`${issue.field}-${issue.code}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {shownWarnings.length > 0 ? (
            <div className="rounded-lg border border-warning/35 bg-warning-surface px-3 py-2.5 text-sm text-warning-foreground">
              <p className="font-semibold">Tips from Google's post rules</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {shownWarnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!onGoogle ? (
            <Field label="Schedule for" htmlFor={fieldId("schedule")} issues={scheduleIssues}>
              <Input
                type="datetime-local"
                {...fieldProps(fieldId("schedule"), scheduleIssues)}
                className="w-full sm:w-64"
                min={scheduleRange.min}
                max={scheduleRange.max}
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:items-end sm:justify-between">
          <Button variant="ghost" onClick={onClose} disabled={busy !== null}>Cancel</Button>
          <div className="flex min-w-0 flex-col gap-2 sm:items-end">
            {!onGoogle && blockedReasons.length > 0 ? <p className="text-xs text-muted-foreground sm:text-right">{blockedReasons.join(" ")}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy !== null} onClick={() => void run("save", save, outcome)}>
                {busy === "save" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                {onGoogle ? "Save on Google" : "Save draft"}
              </Button>
              {!onGoogle ? (
                <>
                  <Button
                    variant="outline"
                    disabled={busy !== null || !scheduleIso || incomplete}
                    title={
                      !scheduleIso
                        ? scheduleInvalid
                          ? "Enter a valid date and time"
                          : "Pick a date and time"
                        : incomplete
                          ? blocksPublish
                            ? touched
                              ? "Fix the issues listed above first"
                              : "Write the post first"
                            : "Pick another time"
                          : undefined
                    }
                    onClick={() => void doSchedule()}
                  >
                    {busy === "schedule" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                    {needsApproval ? "Send for approval" : "Schedule"}
                  </Button>
                  <Button
                    disabled={busy !== null || !summary.connection.gbp_connected || contentBlocked}
                    title={
                      contentBlocked ? (touched ? "Fix the issues listed above first" : "Write the post first") : !summary.connection.gbp_connected ? "Connect Google first" : undefined
                    }
                    onClick={() => void doPublish()}
                  >
                    {busy === "publish" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                    {needsApproval ? "Send for approval now" : "Publish now"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The id of a field's issue messages (`aria-describedby` of its control). */
const issuesId = (controlId: string) => `${controlId}-issues`;

/** id, `aria-invalid` and `aria-describedby` (the field's issues, plus e.g. its counter) for a field's control. */
function fieldProps(id: string, issues: readonly PostIssue[], describedBy?: string) {
  const described = [issues.length > 0 ? issuesId(id) : null, describedBy ?? null].filter(Boolean).join(" ");
  return { id, "aria-invalid": issues.length > 0 || undefined, "aria-describedby": described || undefined };
}

/**
 * A labelled field. `htmlFor` names the control (its issues get `${htmlFor}-issues`, see `fieldProps`);
 * a group of buttons instead takes `labelId`, points `aria-labelledby` at it and is described by
 * `${labelId}-issues`.
 */
function Field({
  label,
  htmlFor,
  labelId,
  issues = [],
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  issues?: PostIssue[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} id={labelId}>
        {label}
      </Label>
      {children}
      {issues.length > 0 ? (
        <div id={htmlFor || labelId ? issuesId(htmlFor ?? labelId ?? "") : undefined} className="space-y-1">
          {issues.map((issue) => (
            <p key={`${issue.field}-${issue.code}`} className="text-xs text-critical">
              {issue.message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Counter({ id, value, max }: { id?: string; value: number; max: number }) {
  return (
    <p id={id} className={cn("text-right text-xs tabular", value > max * 0.95 ? "text-warning-foreground" : "text-muted-foreground")}>
      {value} / {max}
      <span className="sr-only"> characters</span>
    </p>
  );
}

function RecurrenceFields({ form, set, issues }: { form: Form; set: <K extends keyof Form>(key: K, value: Form[K]) => void; issues: PostIssue[] }) {
  const issuesElementId = useId();
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={form.repeats} onCheckedChange={(value) => set("repeats", value === true)} /> Repeats
      </label>
      {form.repeats ? (
        <div
          role="group"
          aria-label="How it repeats"
          aria-describedby={issues.length > 0 ? issuesElementId : undefined}
          className="space-y-3 rounded-md bg-surface-strong p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Select value={form.pattern} onValueChange={(value) => set("pattern", value as PostRecurrence["pattern"])}>
              <SelectTrigger className="w-36" aria-label="How often it repeats"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">until</span>
            <Input type="date" className="w-44" aria-label="Repeats until" value={form.endsOn} onChange={(event) => set("endsOn", event.target.value)} />
          </div>
          {form.pattern === "weekly" ? (
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => {
                const on = form.days.includes(day.id);
                return (
                  <Button
                    key={day.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    className="min-w-12"
                    onClick={() => set("days", on ? form.days.filter((d) => d !== day.id) : [...form.days, day.id])}
                  >
                    {day.short}
                  </Button>
                );
              })}
              <p className="w-full text-xs text-muted-foreground">No day picked = the weekday of the start date.</p>
            </div>
          ) : null}
          {form.pattern === "monthly" ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Select value={form.monthlyBy} onValueChange={(value) => set("monthlyBy", value as Form["monthlyBy"])}>
                <SelectTrigger className="w-48" aria-label="Which day of the month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">On day of month</SelectItem>
                  <SelectItem value="week">On the n-th weekday</SelectItem>
                </SelectContent>
              </Select>
              {form.monthlyBy === "day" ? (
                <Input type="number" min={1} max={31} className="w-20" aria-label="Day of the month" value={form.dayOfMonth} onChange={(event) => set("dayOfMonth", event.target.value)} />
              ) : (
                <Select value={form.weekOfMonth} onValueChange={(value) => set("weekOfMonth", value as WeekOfMonth)}>
                  <SelectTrigger className="w-32" aria-label="Which week"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["FIRST", "SECOND", "THIRD", "FOURTH", "LAST"] as const).map((week) => (
                      <SelectItem key={week} value={week}>{week.charAt(0) + week.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">Google repeats the post itself, for up to a year.</p>
          {issues.length > 0 ? (
            <div id={issuesElementId} className="space-y-1">
              {issues.map((issue) => (
                <p key={`${issue.field}-${issue.code}`} className="text-xs text-critical">
                  {issue.message}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** One photo: upload (cropped to 4:3), pick from the gallery, or create one with AI. */
function PhotoField({
  locationId,
  media,
  onChange,
  photosPublishable,
  imageIdea,
  issues,
}: {
  locationId: string;
  media: PostMedia | null;
  onChange: (media: PostMedia | null) => void;
  photosPublishable: boolean;
  imageIdea: string;
  issues: PostIssue[];
}) {
  const ai = useAiStatus(locationId);
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
  const fileInput = useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const gallery = usePostMedia(locationId, galleryOpen);
  const photos = gallery.data?.pages.flatMap((page) => page.media) ?? [];
  const [uploading, setUploading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [hint, setHint] = useState("");
  const [style, setStyle] = useState<AiImageStyle | "rotate">("rotate");
  const [removing, setRemoving] = useState<string | null>(null);
  const prompt = (hint || imageIdea).trim();
  const photoId = useId();

  const generate = useMutation({
    mutationFn: (input: { prompt: string; style: AiImageStyle | "rotate" }) =>
      aiPostImage(locationId, { prompt_hint: input.prompt, ...(input.style !== "rotate" ? { style: input.style } : {}) }),
    onSuccess: (result) => {
      onChange(result.media);
      noteAiSuccess();
      invalidate();
      setAiOpen(false);
    },
    onError: (error) => toastError(error, "The image couldn't be created"),
  });

  /** 409 `media_in_use` while a post that isn't published yet uses the photo. */
  const removePhoto = async (item: PostMedia) => {
    setRemoving(item.media_id);
    try {
      await deletePostMedia(locationId, item.media_id);
      if (media?.media_id === item.media_id) onChange(null);
      invalidate();
    } catch (err) {
      toastError(err, "The photo couldn't be deleted.");
    } finally {
      setRemoving(null);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      onChange(await uploadPostMedia(locationId, file));
      invalidate();
    } catch (err) {
      toastError(err, "The photo couldn't be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  // The photo has no single control: its buttons form a group named by the label and described by the issues.
  const photoLabelId = `${photoId}-label`;
  return (
    <Field label="Photo (optional)" labelId={photoLabelId} issues={issues}>
      {!photosPublishable ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2 text-xs text-warning-foreground">
          <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
          Publishing photos to Google isn't available yet. You can add a photo to a draft, but a post with a photo won't publish until it is.
        </p>
      ) : null}
      {media ? (
        <div className="relative w-56 overflow-hidden rounded-lg border border-border">
          <img src={media.url} alt="" className="aspect-[4/3] w-full object-cover" />
          <Button size="icon" variant="outline" className="absolute right-1.5 top-1.5 size-8" aria-label="Remove photo" onClick={() => onChange(null)}>
            <Trash2 aria-hidden />
          </Button>
          {media.kind === "ai" ? (
            <StatusBadge tone="ai" icon={Sparkles} size="sm" className="absolute bottom-1.5 left-1.5 bg-card shadow-xs">
              AI image
            </StatusBadge>
          ) : null}
        </div>
      ) : null}
      <div
        role="group"
        aria-labelledby={photoLabelId}
        aria-describedby={issues.length > 0 ? issuesId(photoLabelId) : undefined}
        className="flex flex-wrap gap-2"
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? <LoaderCircle aria-hidden className="animate-spin" /> : <Upload aria-hidden />} Upload
        </Button>
        <Button type="button" size="sm" variant="outline" aria-expanded={galleryOpen} onClick={() => setGalleryOpen((value) => !value)}>
          <ImagePlus aria-hidden /> From gallery
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-ai hover:border-ai/40 hover:bg-ai-surface hover:text-ai"
          aria-expanded={aiOpen}
          disabled={!ai.canRun}
          title={ai.reason}
          onClick={() => {
            setAiOpen((value) => !value);
            setHint((current) => current || imageIdea);
          }}
        >
          <Sparkles aria-hidden /> Create an AI image
          <AiCostChip item="post_image" locationId={locationId} balance={ai.balance} />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        JPEG or PNG, at least 250×250, up to 5 MB, cropped to 4:3. Real photos of your business work best on Google. Photos no post uses are deleted after 30 days.
      </p>
      {!ai.canRun && ai.reason ? <p className="text-xs text-muted-foreground">AI images: {ai.reason}</p> : null}
      {aiOpen && ai.canRun ? (
        <div className="space-y-2 rounded-lg border border-ai/25 bg-ai-surface/50 p-3">
          <Input
            aria-label="Describe the picture"
            placeholder="Describe the picture, e.g. fresh loaves on a wooden table"
            maxLength={500}
            value={hint}
            onChange={(event) => setHint(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={style} onValueChange={(value) => setStyle(value as AiImageStyle | "rotate")}>
              <SelectTrigger className="w-56" aria-label="Style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rotate">Any photo style</SelectItem>
                {STYLE_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STYLE_LABEL[value]}
                    {STOCK_ART_STYLES.has(value) ? " (may look like stock art)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="ai" disabled={generate.isPending || prompt.length < 3} onClick={() => generate.mutate({ prompt, style })}>
              {generate.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
              {generate.isPending ? "Creating… up to a minute" : "Create"}
              <AiCostChip item="post_image" locationId={locationId} variant="inverse" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Images never contain words, logos or brand names.
            {style !== "rotate" && STOCK_ART_STYLES.has(style) ? " This style may look like stock art; Google prefers real photos." : ""}
          </p>
        </div>
      ) : null}
      {galleryOpen ? (
        gallery.isPending ? (
          <LoaderCircle aria-label="Loading photos" className="size-4 animate-spin text-muted-foreground" />
        ) : !photos.length ? (
          <p className="text-xs text-muted-foreground">No photos uploaded for this location yet.</p>
        ) : (
          <>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((item) => (
                <li key={item.media_id} className="relative">
                  <button
                    type="button"
                    aria-label={media?.media_id === item.media_id ? "Chosen photo" : "Use this photo"}
                    aria-pressed={media?.media_id === item.media_id}
                    className={cn(
                      "block w-full cursor-pointer overflow-hidden rounded-md border-2 outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      media?.media_id === item.media_id ? "border-primary" : "border-transparent",
                    )}
                    onClick={() => {
                      onChange(item);
                      setGalleryOpen(false);
                    }}
                  >
                    <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="absolute right-1 top-1 size-7"
                    aria-label="Delete photo"
                    disabled={removing !== null}
                    onClick={() => void removePhoto(item)}
                  >
                    {removing === item.media_id ? <LoaderCircle aria-hidden className="size-3 animate-spin" /> : <X aria-hidden className="size-3" />}
                  </Button>
                </li>
              ))}
            </ul>
            {gallery.hasNextPage ? (
              <Button type="button" size="sm" variant="ghost" disabled={gallery.isFetchingNextPage} onClick={() => void gallery.fetchNextPage()}>
                {gallery.isFetchingNextPage ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Load more
              </Button>
            ) : null}
          </>
        )
      ) : null}
    </Field>
  );
}

/** The value once it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
