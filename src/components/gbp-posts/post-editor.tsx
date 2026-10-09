import { useRef, useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus, LoaderCircle, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  aiDraftPost,
  aiPostImage,
  aiRegeneratePost,
  createPost,
  postAction,
  schedulePost,
  updatePost,
  uploadPostMedia,
  type Post,
  type PostAiDraft,
  type PostCtaType,
  type PostImageStyle,
  type PostMedia,
  type PostTone,
  type PostInput,
  type PostIssue,
  type PostRecurrence,
  type PostsSummary,
  type PostType,
} from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  POST_CTA_LABEL,
  POST_IMAGE_STYLE_LABEL,
  POST_SUMMARY_MAX,
  POST_TONE_LABEL,
  POST_TITLE_MAX,
  POST_TYPE_LABEL,
  isAiUnavailable,
  needsTokens,
  postErrorIssues,
  postErrorMessage,
} from "@/lib/posts/posts";
import { postsKey, usePostAiCosts } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
const WEEKS = ["FIRST", "SECOND", "THIRD", "FOURTH", "LAST"] as const;

type Form = {
  type: PostType;
  summary: string;
  ctaType: PostCtaType | "none";
  ctaUrl: string;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  couponCode: string;
  redeemUrl: string;
  terms: string;
  media: { id: string; url: string } | null;
  repeats: boolean;
  pattern: PostRecurrence["pattern"];
  days: string[];
  monthMode: "day" | "week";
  dayOfMonth: string;
  weekOfMonth: (typeof WEEKS)[number];
  endsOn: string;
  /** `datetime-local` value in the browser's time zone; empty = no time picked. */
  scheduledAt: string;
  /** `ai` once the text came from "Write with AI". */
  source: "manual" | "ai";
  /** The AI's image suggestion, the default prompt for "Create image". */
  imageIdea: string;
};

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd'T'HH:mm");
}

function fromPost(post: Post | null, summary: PostsSummary): Form {
  const dated = post?.event ?? post?.offer ?? null;
  const recurrence = post?.recurrence ?? null;
  const defaultCta = summary.settings.default_cta;
  const media = post?.media[0];
  return {
    type: post?.type ?? "standard",
    summary: post?.summary ?? "",
    ctaType: post ? (post.cta?.type ?? "none") : (defaultCta?.type ?? "none"),
    ctaUrl: post ? (post.cta?.url ?? "") : (defaultCta?.url ?? ""),
    title: dated?.title ?? "",
    startDate: dated?.start?.date ?? "",
    startTime: dated?.start?.time ?? "",
    endDate: dated?.end?.date ?? "",
    endTime: dated?.end?.time ?? "",
    couponCode: post?.offer?.coupon_code ?? "",
    redeemUrl: post?.offer?.redeem_url ?? "",
    terms: post?.offer?.terms ?? "",
    media: media ? { id: media.media_id, url: media.url } : null,
    repeats: recurrence !== null,
    pattern: recurrence?.pattern ?? "weekly",
    days: recurrence?.days_of_week ?? [],
    monthMode: recurrence?.week_of_month ? "week" : "day",
    dayOfMonth: recurrence?.day_of_month ? String(recurrence.day_of_month) : "",
    weekOfMonth: recurrence?.week_of_month ?? "FIRST",
    endsOn: recurrence?.ends_on ?? "",
    scheduledAt: toLocalInput(post?.scheduled_at),
    source: post?.source === "ai" ? "ai" : "manual",
    imageIdea: "",
  };
}

function toInput(form: Form): PostInput {
  const dateTime = (date: string, time: string) => (date ? { date, time: time || null } : null);
  const dated = { title: form.title.trim() || null, start: dateTime(form.startDate, form.startTime), end: dateTime(form.endDate, form.endTime) };
  const recurrence: PostRecurrence | null =
    form.type !== "standard" && form.repeats
      ? {
          pattern: form.pattern,
          days_of_week: form.pattern === "weekly" ? form.days : null,
          day_of_month: form.pattern === "monthly" && form.monthMode === "day" && form.dayOfMonth ? Number(form.dayOfMonth) : null,
          week_of_month: form.pattern === "monthly" && form.monthMode === "week" ? form.weekOfMonth : null,
          ends_on: form.endsOn || null,
        }
      : null;
  return {
    type: form.type,
    summary: form.summary.trim() || null,
    // Offers have no button: Google shows its own "View offer".
    cta: form.type === "offer" || form.ctaType === "none" ? null : { type: form.ctaType, url: form.ctaType === "CALL" ? null : form.ctaUrl.trim() || null },
    event: form.type === "event" ? dated : null,
    offer:
      form.type === "offer"
        ? { ...dated, coupon_code: form.couponCode.trim() || null, redeem_url: form.redeemUrl.trim() || null, terms: form.terms.trim() || null }
        : null,
    recurrence,
    media_ids: form.media ? [form.media.id] : [],
    ...(form.source === "ai" ? { source: "ai" as const } : {}),
  };
}

/**
 * Create or edit a post. Saves a draft, schedules or publishes; with approval on,
 * scheduling and publishing send the post for approval instead.
 */
export function PostEditor({
  locationId,
  post,
  summary,
  onClose,
}: {
  locationId: string;
  /** Null for a new post. */
  post: Post | null;
  summary: PostsSummary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => fromPost(post, summary));
  const [busy, setBusy] = useState<"draft" | "go" | "upload" | "ai" | null>(null);
  const [aiHidden, setAiHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<PostIssue[]>(post?.issues ?? []);
  const fileRef = useRef<HTMLInputElement>(null);

  const published = post?.status === "published" || post?.status === "rejected";
  const keepsStatus = post !== null && ["published", "rejected", "scheduled", "pending_approval", "publishing"].includes(post.status);
  const needsApproval = summary.you.needs_approval;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const issueFor = (field: string) => issues.find((issue) => issue.field === field || issue.field.startsWith(`${field}.`))?.message;

  const done = (saved: Post, message: string) => {
    void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
    toast.success(message, saved.status === "failed" && saved.error ? { description: saved.error.message } : undefined);
    onClose();
  };

  const fail = (err: unknown, fallback: string) => {
    setIssues(postErrorIssues(err));
    setError(postErrorMessage(err, fallback));
  };

  const saveDraft = async () => {
    setBusy("draft");
    setError(null);
    try {
      const saved = post ? await updatePost(locationId, post.post_id, toInput(form)) : await createPost(locationId, { ...toInput(form), action: "draft" });
      done(saved, keepsStatus ? "Post saved" : "Draft saved");
    } catch (err) {
      fail(err, "The post couldn't be saved.");
    } finally {
      setBusy(null);
    }
  };

  const go = async () => {
    setBusy("go");
    setError(null);
    const scheduledAt = form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null;
    try {
      let saved: Post;
      if (!post) {
        saved = await createPost(locationId, {
          ...toInput(form),
          action: scheduledAt ? "schedule" : "publish",
          ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
        });
      } else {
        await updatePost(locationId, post.post_id, toInput(form));
        saved = scheduledAt
          ? await schedulePost(locationId, post.post_id, scheduledAt)
          : await postAction(locationId, post.post_id, "publish");
      }
      done(
        saved,
        saved.status === "pending_approval"
          ? "Sent for approval"
          : saved.status === "scheduled"
            ? "Post scheduled"
            : saved.status === "published"
              ? "Post published"
              : saved.status === "failed"
                ? "The post couldn't be published"
                : "Post saved",
      );
    } catch (err) {
      fail(err, "The post couldn't be scheduled or published.");
    } finally {
      setBusy(null);
    }
  };

  const upload = async (file: File) => {
    setBusy("upload");
    setError(null);
    try {
      const media = await uploadPostMedia(locationId, file);
      set("media", { id: media.media_id, url: media.url });
    } catch (err) {
      setError(postErrorMessage(err, "The photo couldn't be uploaded."));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const goLabel = needsApproval ? "Send for approval" : form.scheduledAt ? "Schedule" : "Publish now";
  const disabled = busy !== null;
  const googlePhoto = post?.source === "google" ? (post.google?.media_url ?? null) : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !disabled) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{post ? "Edit post" : "New post"}</DialogTitle>
          <DialogDescription>
            {published
              ? "Changes are sent to Google straight away."
              : "Save it as a draft, schedule it, or publish it now on your Google Business Profile."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field label="Post type">
            <Select value={form.type} disabled={disabled || published} onValueChange={(value) => set("type", value as PostType)}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(POST_TYPE_LABEL) as PostType[]).map((type) => (
                  <SelectItem key={type} value={type}>{POST_TYPE_LABEL[type]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {published ? <Hint>A published post can't change type. Duplicate it instead.</Hint> : null}
          </Field>

          {form.type !== "standard" ? (
            <div className="space-y-4 rounded-md border border-border p-3">
              <Field label={form.type === "event" ? "Event title" : "Offer title"} error={issueFor(form.type === "event" ? "event.title" : "offer.title")}>
                <Input value={form.title} maxLength={POST_TITLE_MAX} disabled={disabled} onChange={(event) => set("title", event.target.value)} />
                <Hint>{form.title.length} / {POST_TITLE_MAX}</Hint>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts" error={issueFor(`${form.type}.start`)}>
                  <div className="flex gap-2">
                    <Input type="date" value={form.startDate} disabled={disabled} onChange={(event) => set("startDate", event.target.value)} />
                    <Input type="time" value={form.startTime} disabled={disabled} className="w-32" aria-label="Start time (optional)" onChange={(event) => set("startTime", event.target.value)} />
                  </div>
                </Field>
                <Field label="Ends" error={issueFor(`${form.type}.end`)}>
                  <div className="flex gap-2">
                    <Input type="date" value={form.endDate} disabled={disabled} onChange={(event) => set("endDate", event.target.value)} />
                    <Input type="time" value={form.endTime} disabled={disabled} className="w-32" aria-label="End time (optional)" onChange={(event) => set("endTime", event.target.value)} />
                  </div>
                </Field>
              </div>
              <Hint>Dates are the business's local dates. Without a time, it runs the whole day.</Hint>

              {form.type === "offer" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Coupon code (optional)">
                    <Input value={form.couponCode} disabled={disabled} onChange={(event) => set("couponCode", event.target.value)} />
                  </Field>
                  <Field label="Redeem online link (optional)" error={issueFor("offer.redeem_url")}>
                    <Input type="url" placeholder="https://" value={form.redeemUrl} disabled={disabled} onChange={(event) => set("redeemUrl", event.target.value)} />
                  </Field>
                  <Field label="Terms and conditions (optional)" className="sm:col-span-2">
                    <Textarea rows={2} value={form.terms} disabled={disabled} onChange={(event) => set("terms", event.target.value)} />
                  </Field>
                </div>
              ) : null}

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Switch checked={form.repeats} disabled={disabled} onCheckedChange={(value) => set("repeats", value)} />
                  Repeats
                </label>
                {form.repeats ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="How often">
                      <Select value={form.pattern} disabled={disabled} onValueChange={(value) => set("pattern", value as PostRecurrence["pattern"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Every day</SelectItem>
                          <SelectItem value="weekly">Every week</SelectItem>
                          <SelectItem value="monthly">Every month</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Until (optional)" error={issueFor("recurrence.ends_on")}>
                      <Input type="date" value={form.endsOn} disabled={disabled} onChange={(event) => set("endsOn", event.target.value)} />
                    </Field>
                    {form.pattern === "weekly" ? (
                      <Field label="On" className="sm:col-span-2">
                        <div className="flex flex-wrap gap-1.5">
                          {WEEKDAYS.map((day) => {
                            const active = form.days.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                aria-pressed={active}
                                disabled={disabled}
                                onClick={() => set("days", active ? form.days.filter((item) => item !== day) : [...form.days, day])}
                                className={cn(
                                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                                  active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {day.charAt(0) + day.slice(1, 3).toLowerCase()}
                              </button>
                            );
                          })}
                        </div>
                        <Hint>None picked: the weekday of the start date.</Hint>
                      </Field>
                    ) : null}
                    {form.pattern === "monthly" ? (
                      <Field label="On" className="sm:col-span-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Select value={form.monthMode} disabled={disabled} onValueChange={(value) => set("monthMode", value as Form["monthMode"])}>
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day">Day of the month</SelectItem>
                              <SelectItem value="week">Week of the month</SelectItem>
                            </SelectContent>
                          </Select>
                          {form.monthMode === "day" ? (
                            <Input type="number" min={1} max={31} className="w-24" value={form.dayOfMonth} disabled={disabled} aria-label="Day of the month" onChange={(event) => set("dayOfMonth", event.target.value)} />
                          ) : (
                            <Select value={form.weekOfMonth} disabled={disabled} onValueChange={(value) => set("weekOfMonth", value as Form["weekOfMonth"])}>
                              <SelectTrigger className="w-32" aria-label="Week of the month"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {WEEKS.map((week) => <SelectItem key={week} value={week}>{week.charAt(0) + week.slice(1).toLowerCase()}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        {form.monthMode === "week" ? <Hint>The weekday of the start date, e.g. "the second Saturday".</Hint> : null}
                      </Field>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {!aiHidden ? (
            <AiAssist
              locationId={locationId}
              post={post && !published && post.source !== "google" ? post : null}
              type={form.type}
              ctaType={form.ctaType}
              imageIdea={form.imageIdea}
              disabled={disabled}
              onBusy={(value) => setBusy(value ? "ai" : null)}
              onUnavailable={() => setAiHidden(true)}
              onDraft={(draft) =>
                setForm((current) => ({
                  ...current,
                  summary: draft.summary,
                  title: current.type !== "standard" && draft.event_title ? draft.event_title : current.title,
                  ctaType: current.type !== "offer" && draft.cta_type ? draft.cta_type : current.ctaType,
                  imageIdea: draft.image_idea ?? current.imageIdea,
                  source: "ai",
                }))
              }
              onImage={(media) => set("media", { id: media.media_id, url: media.url })}
              onRegenerated={(updated) => {
                setForm(fromPost(updated, summary));
                setIssues(updated.issues);
                void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
              }}
            />
          ) : null}

          <Field label="Text" error={issueFor("summary")}>
            <Textarea rows={5} value={form.summary} maxLength={POST_SUMMARY_MAX} disabled={disabled} onChange={(event) => set("summary", event.target.value)} />
            <Hint>{form.summary.length.toLocaleString()} / {POST_SUMMARY_MAX.toLocaleString()} · Posts of 150–300 characters usually do best. Avoid phone numbers and links in the text: Google often rejects them.</Hint>
          </Field>

          <Field label="Photo" error={issueFor("media")}>
            {form.media || googlePhoto ? (
              <div className="flex items-start gap-3">
                <img src={form.media?.url ?? googlePhoto ?? ""} alt="" className="h-24 w-32 rounded-md border border-border object-cover" />
                {form.media ? (
                  <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => set("media", null)}>
                    <Trash2 aria-hidden /> Remove
                  </Button>
                ) : (
                  <Hint>Added on Google.</Hint>
                )}
              </div>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => fileRef.current?.click()}>
                  {busy === "upload" ? <LoaderCircle aria-hidden className="animate-spin" /> : <ImagePlus aria-hidden />} Upload photo
                </Button>
                <Hint>One JPEG or PNG, up to 5 MB, at least 250 × 250. It's cropped to 4:3.</Hint>
                {!summary.connection.photos_publishable ? <Hint>Photos can't be published from this server; text posts work.</Hint> : null}
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </Field>

          {form.type !== "offer" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Button">
                <Select value={form.ctaType} disabled={disabled} onValueChange={(value) => set("ctaType", value as Form["ctaType"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No button</SelectItem>
                    {(Object.keys(POST_CTA_LABEL) as PostCtaType[]).map((cta) => (
                      <SelectItem key={cta} value={cta}>{POST_CTA_LABEL[cta]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {form.ctaType !== "none" && form.ctaType !== "CALL" ? (
                <Field label="Button link" error={issueFor("cta.url") ?? issueFor("cta")}>
                  <Input type="url" placeholder="https://" value={form.ctaUrl} disabled={disabled} onChange={(event) => set("ctaUrl", event.target.value)} />
                </Field>
              ) : form.ctaType === "CALL" ? (
                <Hint>Uses the phone number on your Business Profile.</Hint>
              ) : null}
            </div>
          ) : null}

          {!published ? (
            <Field label="Publish at (optional)" error={issueFor("scheduled_at")}>
              <Input type="datetime-local" className="sm:w-64" value={form.scheduledAt} disabled={disabled} onChange={(event) => set("scheduledAt", event.target.value)} />
              <Hint>Your local time. Leave empty to publish now. At least 2 minutes and at most a year ahead.</Hint>
            </Field>
          ) : null}

          {post && post.warnings.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-warning/35 bg-warning-surface/40 p-3 text-sm text-warning-foreground">
              {post.warnings.map((warning) => (
                <li key={warning.code} className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />{warning.message}</li>
              ))}
            </ul>
          ) : null}

          {issues.length > 0 || error ? (
            <div role="alert" className="rounded-md border border-critical/25 bg-critical-surface/40 p-3 text-sm text-critical">
              {error ? <p className="font-medium">{error}</p> : <p className="font-medium">Before this can be scheduled or published:</p>}
              {issues.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {issues.map((issue) => <li key={`${issue.field}-${issue.code}`}>{issue.message}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" disabled={disabled} onClick={onClose}>Cancel</Button>
          <Button variant="outline" disabled={disabled} onClick={() => void saveDraft()}>
            {busy === "draft" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
            {keepsStatus ? "Save changes" : "Save draft"}
          </Button>
          {!published ? (
            <Button disabled={disabled} onClick={() => void go()}>
              {busy === "go" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
              {goLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const tokens = (count: number) => `${count} token${count === 1 ? "" : "s"}`;

/**
 * "Write with AI" (text variants), "Create image" (with a style) and, on a saved post
 * that isn't on Google yet, "New text" / "New image". Every button shows its token cost.
 */
function AiAssist({
  locationId,
  post,
  type,
  ctaType,
  imageIdea,
  disabled,
  onBusy,
  onUnavailable,
  onDraft,
  onImage,
  onRegenerated,
}: {
  locationId: string;
  /** A saved post that can be regenerated, else null. */
  post: Post | null;
  type: PostType;
  ctaType: PostCtaType | "none";
  imageIdea: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onUnavailable: () => void;
  onDraft: (draft: PostAiDraft) => void;
  onImage: (media: PostMedia) => void;
  onRegenerated: (post: Post) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const costs = usePostAiCosts();
  const [mode, setMode] = useState<"text" | "image" | null>(null);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<PostTone>("friendly");
  const [variants, setVariants] = useState("2");
  const [drafts, setDrafts] = useState<PostAiDraft[]>([]);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<PostImageStyle | "auto">("auto");
  const [working, setWorking] = useState<"text" | "image" | "regen-text" | "regen-image" | null>(null);

  const run = async (kind: NonNullable<typeof working>, task: () => Promise<void>) => {
    setWorking(kind);
    onBusy(true);
    try {
      await task();
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    } catch (err) {
      if (isAiUnavailable(err)) {
        toast.error("AI isn't set up on the server yet.");
        onUnavailable();
      } else {
        toast.error(
          postErrorMessage(err, "The AI couldn't do that. Try again."),
          needsTokens(err) ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined,
        );
      }
    } finally {
      setWorking(null);
      onBusy(false);
    }
  };

  const write = () =>
    run("text", async () => {
      const result = await aiDraftPost(locationId, {
        topic: topic.trim(),
        tone,
        type,
        ...(ctaType !== "none" ? { cta_type: ctaType } : {}),
        variants: Number(variants),
      });
      setDrafts(result.drafts);
    });

  const createImage = () =>
    run("image", async () => {
      const hint = (prompt || imageIdea || topic).trim();
      const result = await aiPostImage(locationId, { prompt_hint: hint, ...(style !== "auto" ? { style } : {}) });
      onImage(result.media);
      toast.success(`Image created (${POST_IMAGE_STYLE_LABEL[result.style] ?? result.style})`);
      setMode(null);
    });

  const regenerate = (what: "text" | "image") =>
    run(what === "text" ? "regen-text" : "regen-image", async () => {
      if (!post) return;
      const result = await aiRegeneratePost(locationId, post.post_id, { text: what === "text", image: what === "image", ...(topic.trim() ? { topic: topic.trim() } : {}), tone });
      onRegenerated(result.post);
      toast.success(what === "text" ? "New text written" : "New image created");
    });

  const off = disabled || working !== null;

  return (
    <div className="space-y-3 rounded-md border border-primary/20 bg-brand-tint/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <span className="text-sm font-medium text-foreground">AI assist</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={mode === "text" ? "default" : "outline"} disabled={off} onClick={() => setMode(mode === "text" ? null : "text")}>
            <Wand2 aria-hidden /> Write with AI
          </Button>
          <Button type="button" size="sm" variant={mode === "image" ? "default" : "outline"} disabled={off} onClick={() => { setMode(mode === "image" ? null : "image"); setPrompt(imageIdea); }}>
            <ImagePlus aria-hidden /> Create image
          </Button>
          {post ? (
            <>
              <Button type="button" size="sm" variant="outline" disabled={off} onClick={() => void regenerate("text")}>
                {working === "regen-text" ? <LoaderCircle aria-hidden className="animate-spin" /> : null} New text · {tokens(costs.draft)}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={off} onClick={() => void regenerate("image")}>
                {working === "regen-image" ? <LoaderCircle aria-hidden className="animate-spin" /> : null} New image · {tokens(costs.image)}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {mode === "text" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Input value={topic} placeholder="What's the post about? e.g. our new rye loaf" disabled={off} aria-label="Topic" onChange={(event) => setTopic(event.target.value)} />
            <Select value={tone} disabled={off} onValueChange={(value) => setTone(value as PostTone)}>
              <SelectTrigger className="sm:w-36" aria-label="Tone"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(POST_TONE_LABEL) as PostTone[]).map((value) => <SelectItem key={value} value={value}>{POST_TONE_LABEL[value]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={variants} disabled={off} onValueChange={setVariants}>
              <SelectTrigger className="sm:w-32" aria-label="Variants"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["1", "2", "3"].map((value) => <SelectItem key={value} value={value}>{value} version{value === "1" ? "" : "s"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" disabled={off || !topic.trim()} onClick={() => void write()}>
            {working === "text" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Wand2 aria-hidden />} Write · {tokens(costs.draft)}
          </Button>
          {drafts.length > 0 ? (
            <ul className="space-y-2">
              {drafts.map((draft, index) => (
                <li key={index} className="rounded-md border border-border bg-surface p-3">
                  {draft.event_title && type !== "standard" ? <p className="text-sm font-semibold text-foreground">{draft.event_title}</p> : null}
                  <p className="whitespace-pre-line text-sm text-foreground">{draft.summary}</p>
                  <Button type="button" size="sm" variant="outline" className="mt-2" disabled={off} onClick={() => { onDraft(draft); setDrafts([]); setMode(null); }}>
                    Use this
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {mode === "image" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input value={prompt} placeholder="What should the image show? e.g. fresh loaves on a wooden table" disabled={off} aria-label="Image description" onChange={(event) => setPrompt(event.target.value)} />
            <Select value={style} disabled={off} onValueChange={(value) => setStyle(value as PostImageStyle | "auto")}>
              <SelectTrigger className="sm:w-44" aria-label="Style"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Any style</SelectItem>
                {(Object.keys(POST_IMAGE_STYLE_LABEL) as PostImageStyle[]).map((value) => <SelectItem key={value} value={value}>{POST_IMAGE_STYLE_LABEL[value]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" disabled={off || !(prompt || imageIdea || topic).trim()} onClick={() => void createImage()}>
              {working === "image" ? <LoaderCircle aria-hidden className="animate-spin" /> : <ImagePlus aria-hidden />} Create · {tokens(costs.image)}
            </Button>
            {working === "image" ? <span className="text-xs text-muted-foreground">Creating the image. This can take up to a minute.</span> : <Hint>Images never contain words or logos. It replaces the current photo.</Hint>}
          </div>
        </div>
      ) : null}

      {working === "regen-image" ? <p className="text-xs text-muted-foreground">Creating the image. This can take up to a minute.</p> : null}
      {costs.balance !== null ? <Hint>Token balance: {costs.balance}</Hint> : null}
    </div>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string | undefined; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-critical">{error}</p> : null}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
