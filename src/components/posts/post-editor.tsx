import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ImagePlus, LoaderCircle, Sparkles, Trash2, Upload, X } from "lucide-react";
import {
  aiDraftPost,
  aiPostImage,
  createPost,
  deletePostMedia,
  validatePost,
  runPostAction,
  schedulePost,
  updatePost,
  uploadPostMedia,
  type AiImageStyle,
  type AiPostDraft,
  type CtaType,
  type Post,
  type PostInput,
  type PostIssue,
  type PostMedia,
  type PostRecurrence,
  type PostsSummary,
  type PostTone,
  type PostType,
  type WeekOfMonth,
  type Weekday,
} from "@/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CTA_LABEL,
  STYLE_LABEL,
  TONE_LABEL,
  WEEKDAYS,
  postErrorText,
  postFailureText,
  postsKey,
  tokens,
  useAiAvailable,
  useAiCosts,
  useInvalidatePosts,
  usePostMedia,
} from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";

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

/** A local `datetime-local` value two hours from now, rounded to the quarter hour. */
function defaultScheduleValue(): string {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Create or edit a post. Issues (what blocks publishing) and warnings come from the
 * backend on every saved post; a draft may be incomplete.
 */
export function PostEditor({
  locationId,
  post,
  summary,
  onClose,
}: {
  locationId: string;
  post: Post | null;
  summary: PostsSummary;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const invalidate = useInvalidatePosts(locationId);
  const [saved, setSaved] = useState<Post | null>(post);
  const [form, setForm] = useState<Form>(() => fromPost(post, summary.settings));
  const [scheduleAt, setScheduleAt] = useState(() => {
    if (!post?.scheduled_at) return defaultScheduleValue();
    const date = new Date(post.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [savedIssues, setIssues] = useState<PostIssue[]>(post?.issues ?? []);
  const [savedWarnings, setWarnings] = useState(post?.warnings ?? []);
  const [imageIdea, setImageIdea] = useState("");
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  const onGoogle = saved?.status === "published" || saved?.status === "rejected";
  const needsApproval = summary.you.needs_approval;
  // Live check while typing (`POST posts/validate`): the full current content, nothing saved.
  const draftInput = { ...toInput(form), type: form.type, ...(!onGoogle && scheduleAt ? { scheduled_at: new Date(scheduleAt).toISOString() } : {}) };
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
  const issueFor = (field: string) => issues.filter((issue) => issue.field === field || issue.field.startsWith(`${field}.`));

  const fail = (err: unknown, fallback: string) => {
    const { message, buyTokens, reload } = postErrorText(err, fallback);
    const data = (err as { details?: { data?: { issues?: PostIssue[] } } })?.details?.data;
    if (data?.issues) setIssues(data.issues);
    if (reload) {
      invalidate();
      onClose();
    }
    toast.error(message, buyTokens ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined);
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

  const scheduleIso = () => new Date(scheduleAt).toISOString();
  const doSchedule = () =>
    run("schedule", async () => {
      if (!saved) return createPost(locationId, { ...toInput(form), action: "schedule", scheduled_at: scheduleIso() });
      await save();
      return schedulePost(locationId, saved.post_id, scheduleIso());
    }, outcome);
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
          <DialogTitle>{saved ? "Edit post" : "New post"}</DialogTitle>
          <DialogDescription>
            {onGoogle
              ? "This post is on Google: saving updates it there (only the changed fields)."
              : "Write the post, then save it as a draft, schedule it or publish it now."}
          </DialogDescription>
        </DialogHeader>

        {!summary.connection.gbp_connected ? (
          <p className="rounded-md border border-warning/40 bg-warning-surface/40 px-3 py-2 text-sm text-warning-foreground">
            Connect this location to Google to publish. You can still write drafts.
          </p>
        ) : null}

        <div className="space-y-5">
          <Field label="Post type">
            <div className="flex flex-wrap gap-2">
              {(["standard", "event", "offer"] as const).map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant={form.type === type ? "default" : "outline"}
                  disabled={onGoogle && form.type !== type}
                  title={onGoogle && form.type !== type ? "A published post's type can't change; duplicate it instead" : undefined}
                  onClick={() => set("type", type)}
                >
                  {type === "standard" ? "Update" : type === "event" ? "Event" : "Offer"}
                </Button>
              ))}
            </div>
          </Field>

          <AiWriter
            locationId={locationId}
            type={form.type}
            onPick={(draft) => {
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
              <Field label={`${form.type === "event" ? "Event" : "Offer"} title`} issues={issueFor("event.title")}>
                <Input value={form.title} maxLength={TITLE_MAX} onChange={(event) => set("title", event.target.value)} />
                <Counter value={form.title.length} max={TITLE_MAX} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Starts" issues={issueFor("event.start")}>
                  <div className="flex gap-2">
                    <Input type="date" value={form.startDate} onChange={(event) => set("startDate", event.target.value)} />
                    <Input type="time" aria-label="Start time (optional)" value={form.startTime} onChange={(event) => set("startTime", event.target.value)} />
                  </div>
                </Field>
                <Field label="Ends" issues={issueFor("event.end")}>
                  <div className="flex gap-2">
                    <Input type="date" value={form.endDate} onChange={(event) => set("endDate", event.target.value)} />
                    <Input type="time" aria-label="End time (optional)" value={form.endTime} onChange={(event) => set("endTime", event.target.value)} />
                  </div>
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">Dates are the location's local dates. Without a time, it covers the whole day.</p>
              <RecurrenceFields form={form} set={set} issues={issueFor("recurrence")} />
            </div>
          ) : null}

          <Field label="Text" issues={issueFor("summary")}>
            <Textarea rows={6} maxLength={SUMMARY_MAX} value={form.summary} onChange={(event) => set("summary", event.target.value)} />
            <Counter value={form.summary.length} max={SUMMARY_MAX} />
          </Field>

          {form.type === "offer" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Coupon code (optional)" issues={issueFor("offer.coupon_code")}>
                <Input value={form.coupon} onChange={(event) => set("coupon", event.target.value)} />
              </Field>
              <Field label="Redeem online (optional, https)" issues={issueFor("offer.redeem_url")}>
                <Input type="url" value={form.redeemUrl} onChange={(event) => set("redeemUrl", event.target.value)} />
              </Field>
              <Field label="Terms (optional)" className="sm:col-span-2" issues={issueFor("offer.terms")}>
                <Textarea rows={2} value={form.terms} onChange={(event) => set("terms", event.target.value)} />
              </Field>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
              <Field label="Button" issues={issueFor("cta")}>
                <Select value={form.ctaType} onValueChange={(value) => set("ctaType", value as Form["ctaType"])}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CTA}>No button</SelectItem>
                    {(Object.keys(CTA_LABEL) as CtaType[]).map((type) => (
                      <SelectItem key={type} value={type}>{CTA_LABEL[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {form.ctaType !== NO_CTA && form.ctaType !== "CALL" ? (
                <Field label="Button link (https)" issues={issueFor("cta.url")}>
                  <Input type="url" placeholder="https://" value={form.ctaUrl} onChange={(event) => set("ctaUrl", event.target.value)} />
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

          {issues.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-critical/25 bg-critical-surface/40 px-3 py-2 text-sm text-critical" role="alert">
              {issues.map((issue) => (
                <li key={`${issue.field}-${issue.code}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-warning/40 bg-warning-surface/40 px-3 py-2 text-xs text-warning-foreground">
              {warnings.map((warning) => (
                <li key={warning.code}>{warning.message}</li>
              ))}
            </ul>
          ) : null}

          {!onGoogle ? (
            <Field label="Schedule for">
              <Input type="datetime-local" className="w-full sm:w-64" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} />
            </Field>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClose} disabled={busy !== null}>Cancel</Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy !== null} onClick={() => void run("save", save, outcome)}>
              {busy === "save" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
              {onGoogle ? "Save on Google" : "Save draft"}
            </Button>
            {!onGoogle ? (
              <>
                <Button
                  variant="outline"
                  disabled={busy !== null || !scheduleAt || incomplete}
                  title={incomplete ? "Fix the issues listed above first" : undefined}
                  onClick={() => void doSchedule()}
                >
                  {busy === "schedule" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                  {needsApproval ? "Send for approval" : "Schedule"}
                </Button>
                <Button
                  disabled={busy !== null || !summary.connection.gbp_connected || (validation.data !== undefined && blocksPublish)}
                  title={validation.data !== undefined && blocksPublish ? "Fix the issues listed above first" : undefined}
                  onClick={() => void doPublish()}
                >
                  {busy === "publish" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                  {needsApproval ? "Send for approval now" : "Publish now"}
                </Button>
              </>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, issues = [], className, children }: { label: string; issues?: PostIssue[]; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {issues.map((issue) => (
        <p key={issue.code} className="text-xs text-critical">{issue.message}</p>
      ))}
    </div>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return <p className={cn("text-right text-xs tabular", value > max * 0.95 ? "text-warning-foreground" : "text-muted-foreground")}>{value} / {max}</p>;
}

function RecurrenceFields({ form, set, issues }: { form: Form; set: <K extends keyof Form>(key: K, value: Form[K]) => void; issues: PostIssue[] }) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={form.repeats} onCheckedChange={(value) => set("repeats", value === true)} /> Repeats
      </label>
      {form.repeats ? (
        <div className="space-y-3 rounded-md bg-surface-strong p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={form.pattern} onValueChange={(value) => set("pattern", value as PostRecurrence["pattern"])}>
              <SelectTrigger className="w-36 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">until</span>
            <Input type="date" className="w-44" value={form.endsOn} onChange={(event) => set("endsOn", event.target.value)} />
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
                    className="h-7 px-2.5 text-xs"
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
                <SelectTrigger className="w-44 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">On day of month</SelectItem>
                  <SelectItem value="week">On the n-th weekday</SelectItem>
                </SelectContent>
              </Select>
              {form.monthlyBy === "day" ? (
                <Input type="number" min={1} max={31} className="w-20" value={form.dayOfMonth} onChange={(event) => set("dayOfMonth", event.target.value)} />
              ) : (
                <Select value={form.weekOfMonth} onValueChange={(value) => set("weekOfMonth", value as WeekOfMonth)}>
                  <SelectTrigger className="w-32 bg-background"><SelectValue /></SelectTrigger>
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
          {issues.map((issue) => (
            <p key={issue.code} className="text-xs text-critical">{issue.message}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** "Write with AI": 1–3 variants for a topic; picking one fills the editor (nothing is saved). */
function AiWriter({ locationId, type, onPick }: { locationId: string; type: PostType; onPick: (draft: AiPostDraft) => void }) {
  const navigate = useNavigate();
  const costs = useAiCosts();
  const invalidate = useInvalidatePosts(locationId);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<PostTone>("friendly");
  const [variants, setVariants] = useState("2");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<AiPostDraft[]>([]);
  const aiAvailable = useAiAvailable();
  if (!aiAvailable) return null;

  const write = async () => {
    setBusy(true);
    try {
      const result = await aiDraftPost(locationId, { topic: topic.trim(), tone, type, variants: Number(variants) });
      setDrafts(result.drafts);
      invalidate();
    } catch (err) {
      const { message, buyTokens } = postErrorText(err, "The AI couldn't write a post. Try again.");
      toast.error(message, buyTokens ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles aria-hidden /> Write with AI ({tokens(costs.draft)})
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-lg border border-primary/25 bg-brand-tint/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Write with AI</p>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Close" onClick={() => setOpen(false)}><X aria-hidden /></Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_110px]">
        <Input placeholder="What's the post about? e.g. new rye loaf" value={topic} onChange={(event) => setTopic(event.target.value)} />
        <Select value={tone} onValueChange={(value) => setTone(value as PostTone)}>
          <SelectTrigger className="bg-background" aria-label="Tone"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(TONE_LABEL) as PostTone[]).map((value) => <SelectItem key={value} value={value}>{TONE_LABEL[value]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={variants} onValueChange={setVariants}>
          <SelectTrigger className="bg-background" aria-label="Variants"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["1", "2", "3"].map((value) => <SelectItem key={value} value={value}>{value} version{value === "1" ? "" : "s"}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" disabled={busy || topic.trim().length < 2} onClick={() => void write()}>
        {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} Write ({tokens(costs.draft)})
      </Button>
      {drafts.length > 0 ? (
        <ul className="grid gap-2">
          {drafts.map((draft, index) => (
            <li key={index} className="rounded-md border border-border bg-background p-3 text-sm">
              {draft.event_title ? <p className="font-semibold text-foreground">{draft.event_title}</p> : null}
              <p className="whitespace-pre-line text-foreground">{draft.summary}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => onPick(draft)}>Use this</Button>
            </li>
          ))}
        </ul>
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
  const navigate = useNavigate();
  const costs = useAiCosts();
  const invalidate = useInvalidatePosts(locationId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const gallery = usePostMedia(locationId, galleryOpen);
  const photos = gallery.data?.pages.flatMap((page) => page.media) ?? [];
  const [uploading, setUploading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [hint, setHint] = useState("");
  const [style, setStyle] = useState<AiImageStyle | "rotate">("rotate");
  const [generating, setGenerating] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const aiAvailable = useAiAvailable();

  /** 409 `media_in_use` while a post that isn't published yet uses the photo. */
  const removePhoto = async (item: PostMedia) => {
    setRemoving(item.media_id);
    try {
      await deletePostMedia(locationId, item.media_id);
      if (media?.media_id === item.media_id) onChange(null);
      invalidate();
    } catch (err) {
      toast.error(postErrorText(err, "The photo couldn't be deleted.").message);
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
      toast.error(postErrorText(err, "The photo couldn't be uploaded.").message);
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await aiPostImage(locationId, { prompt_hint: (hint || imageIdea).trim(), ...(style !== "rotate" ? { style } : {}) });
      onChange(result.media);
      invalidate();
      setAiOpen(false);
    } catch (err) {
      const { message, buyTokens } = postErrorText(err, "The image couldn't be created. Try again.");
      toast.error(message, buyTokens ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Field label="Photo (optional)" issues={issues}>
      {!photosPublishable ? (
        <p className="text-xs text-warning-foreground">This server can't publish photos yet (it isn't reachable by Google). Uploads work, but a post with a photo will fail to publish.</p>
      ) : null}
      {media ? (
        <div className="relative w-56 overflow-hidden rounded-md border border-border">
          <img src={media.url} alt="" className="aspect-[4/3] w-full object-cover" />
          <Button size="icon" variant="secondary" className="absolute right-1.5 top-1.5 size-7" aria-label="Remove photo" onClick={() => onChange(null)}>
            <Trash2 aria-hidden />
          </Button>
          {media.kind === "ai" ? <span className="absolute bottom-1.5 left-1.5 rounded bg-background/90 px-1.5 text-[10px] font-semibold">AI</span> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
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
        <Button type="button" size="sm" variant="outline" onClick={() => setGalleryOpen((value) => !value)}>
          <ImagePlus aria-hidden /> From gallery
        </Button>
        {aiAvailable ? (
          <Button type="button" size="sm" variant="outline" onClick={() => { setAiOpen((value) => !value); setHint((current) => current || imageIdea); }}>
            <Sparkles aria-hidden /> Create image ({tokens(costs.image)})
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">JPEG or PNG, at least 250×250, up to 5 MB. Photos are cropped to 4:3. Photos no post uses are deleted after 30 days.</p>
      {aiOpen && aiAvailable ? (
        <div className="space-y-2 rounded-md border border-primary/25 bg-brand-tint/40 p-3">
          <Input placeholder="Describe the picture, e.g. fresh loaves on a wooden table" value={hint} onChange={(event) => setHint(event.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={style} onValueChange={(value) => setStyle(value as AiImageStyle | "rotate")}>
              <SelectTrigger className="w-48 bg-background" aria-label="Style"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rotate">Any style</SelectItem>
                {(Object.keys(STYLE_LABEL) as AiImageStyle[]).map((value) => <SelectItem key={value} value={value}>{STYLE_LABEL[value]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={generating || (hint || imageIdea).trim().length < 3} onClick={() => void generate()}>
              {generating ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
              {generating ? "Creating… (up to a minute)" : `Create (${tokens(costs.image)})`}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Images never contain words, logos or brand names.</p>
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
                  className={cn("block w-full overflow-hidden rounded-md border-2", media?.media_id === item.media_id ? "border-primary" : "border-transparent")}
                  onClick={() => { onChange(item); setGalleryOpen(false); }}
                >
                  <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" />
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-1 top-1 size-6"
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
