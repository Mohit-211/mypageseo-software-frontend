import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus, LoaderCircle, Lock, Sparkles, Trash2, Undo2, Upload, X } from "lucide-react";
import {
  aiDraftPost,
  aiPostImage,
  aiRevisePost,
  createPost,
  deletePostMedia,
  getPost,
  validatePost,
  runPostAction,
  schedulePost,
  updatePost,
  uploadPostMedia,
  type AiDraftInput,
  type AiImageStyle,
  type AiReviseInput,
  type ApiError,
  type CtaType,
  type Post,
  type PostAiFinding,
  type PostAiImageRun,
  type PostAiRun,
  type PostAiRunKind,
  type PostAiRunStart,
  type PostInput,
  type PostIssue,
  type PostMedia,
  type PostMediaDetails,
  type PostRecurrence,
  type PostsSummary,
  type PostType,
  type WeekOfMonth,
  type Weekday,
} from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAiFacts } from "@/lib/ai-settings/use-ai-settings";
import { locationPath } from "@/lib/mypageseo/section-links";
import { RUN_POLL_MS, activePostRunsKey, runHasEnded, runIsActive, useActivePostRuns, useAiRun } from "@/lib/posts/ai-runs";
import { postProblemWords } from "@/lib/posts/approval-labels";
import { usePostEditorOnScreen } from "@/lib/posts/open-post";
import { usePostAiState, type PostAiState } from "@/lib/posts/post-ai-state";
import {
  OFFER_RULE_CODES,
  POST_RULE_WORDS,
  checksFailedFindings,
  incompleteIssues,
  locateFinding,
  logoSkippedText,
  mediaLabel,
  mergeFindings,
  standingHardFindings,
  type StandingContext,
} from "@/lib/posts/post-findings";
import { useToastPostError } from "@/lib/posts/post-toasts";
import { retryStartOf, runNotes, useOnRunEnd, usePostRunStart } from "@/lib/posts/use-post-runs";
import {
  CTA_LABEL,
  PICTURE_HINT_MAX,
  PICTURE_HINT_MIN,
  STOCK_ART_STYLES,
  STYLE_LABEL,
  STYLE_ORDER,
  WEEKDAYS,
  postsKey,
  useInvalidatePosts,
  useLibraryPhotos,
  useMediaDetails,
  usePost,
  usePostMedia,
} from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";
import { EditorAiPanel } from "./post-editor-ai";
import { PostAiFacts, PostFindingsList } from "./post-findings";
import { DeclinedNotice, DismissButton, PictureOutcome, RunFailure, RunNotes, RunProgress, SeriesSlotProgress } from "./run-status";

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

/** How often a series post its series is writing is read again (it has no run to poll). */
const SLOT_POLL_MS = 10_000;

const RUN_FAILED_TITLE: Record<PostAiRunKind, string> = {
  draft: "Your post couldn't be written",
  revise: "Your post couldn't be changed",
  image: "The picture couldn't be made",
  series_next: "The next post couldn't be written",
  plan: "Topics couldn't be planned",
};

/**
 * Create or edit a post. Issues (what blocks publishing) and warnings come from the backend's live check on every
 * change; a draft may be incomplete.
 *
 * The AI (post writer v2 and background runs; 2026-11-16 "Post writer v2", 2026-11-17 section 1):
 * - "Write with AI" fills a post without text (with `post_id` once it is saved; else the run makes the draft),
 *   "Change it" rewrites a post not on Google yet, "Create a picture" makes its picture. Each is a run: the editor
 *   shows its progress and, when it ends, loads the AI's post (or offers it, when the form changed meanwhile).
 *   "Write with AI" (and Generate next) write the text, type, button, dates, offer and photo: those stay locked
 *   until the run ends. The editor may be closed meanwhile: the run goes on.
 * - A run found on the post when it opens (a teammate's, or one started earlier) shows the same way; a series post
 *   its series is writing is read again until it is written. The runs come from the location's list that the page
 *   polls (`useActivePostRuns(locationId)`, mounted by both pages that open the editor), so nothing is polled twice.
 * - `post.ai`: how the AI wrote it and the checks' findings. A hard finding that still stands (`standingHardFindings`,
 *   the backend's rule) blocks Schedule and Publish (the server answers 422 `checks_failed`); the regulated post
 *   rules come from the live check.
 * - Saving an unchanged saved post sends nothing (the backend refuses an empty PATCH): Schedule and Publish go
 *   straight to their own call. A new "Schedule for" time is applied by scheduling only: Save draft schedules a
 *   scheduled post again for it, and elsewhere says so instead of "Saved." when the time is the only change.
 * - Closing it with unsaved changes (the form, or a new "Schedule for" time) asks first ("Discard your changes?"): the
 *   X, Escape, a click outside, Cancel, and leaving the page (e.g. a toast's "Buy tokens", Back); closing the tab or
 *   reloading asks the browser's own question. It never asks when nothing changed, nor when it closes itself after a
 *   save, schedule, publish or send for approval. While it saves (busy) the form takes no input and it can't be closed:
 *   leaving the page waits for the save, then goes on (or asks, if the save failed and changes are left).
 * - While it is open, "Open it" on a post's toast never replaces it (`usePostEditorOnScreen`, open-post.ts).
 *
 * `aiOpen` opens the AI panel straight away; `run` is the run that just wrote or changed the post (its notes show).
 * `onClose` closes it at once: the page's own close, also used after a save; the person's closes ask first.
 */
export function PostEditor({
  locationId,
  post,
  summary,
  onClose,
  aiOpen = false,
  run: firstRun = null,
}: {
  locationId: string;
  post: Post | null;
  summary: PostsSummary;
  onClose: () => void;
  aiOpen?: boolean;
  run?: PostAiRun | null;
}) {
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
  const starter = usePostRunStart();
  const ai = usePostAiState(locationId, summary);
  const facts = useAiFacts(locationId);
  const [saved, setSaved] = useState<Post | null>(post);
  usePostEditorOnScreen(saved?.post_id ?? null);
  const [form, setForm] = useState<Form>(() => fromPost(post, summary.settings));
  // "Schedule for" as it opened (or as the post was last loaded): a new time is a change to keep.
  const [scheduleStart, setScheduleStart] = useState(() => (post?.scheduled_at ? localInputValue(new Date(post.scheduled_at)) : defaultScheduleValue()));
  const [scheduleAt, setScheduleAt] = useState(scheduleStart);
  // Read once when the editor opens (never during render).
  const [scheduleRange] = useState(scheduleRangeFromNow);
  const [busy, setBusy] = useState<string | null>(null);
  const [savedIssues, setIssues] = useState<PostIssue[]>(post?.issues ?? []);
  const [savedWarnings, setWarnings] = useState(post?.warnings ?? []);
  // A brand-new, empty post doesn't open with red errors: issues show once something is written (or a save fails).
  const [touched, setTouched] = useState(Boolean(post));
  // The AI: the run this editor started, the last run that ended, and the form (and photo) when the run started.
  const [runId, setRunId] = useState<string | null>(() => (firstRun && runIsActive(firstRun) ? firstRun.run_id : null));
  const [endedRun, setEndedRun] = useState<PostAiRun | null>(() => (firstRun && runHasEnded(firstRun) ? firstRun : null));
  const [baseline, setBaseline] = useState(() => JSON.stringify(toInput(fromPost(post, summary.settings))));
  const [startMediaId, setStartMediaId] = useState<string | null>(() => post?.media[0]?.media_id ?? null);
  // The AI's post when the form changed while it worked (offered, not loaded over the person's changes).
  const [aiVersion, setAiVersion] = useState<Post | null>(null);
  const [aiStarting, setAiStarting] = useState(false);
  const [declined, setDeclined] = useState<ApiError | null>(null);
  const [checkFindings, setCheckFindings] = useState<PostAiFinding[]>([]);
  // "Save draft" was pressed with a new time it can't keep (only Schedule sets a time): said next to the buttons.
  const [timeNote, setTimeNote] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setTouched(true);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onGoogle = saved?.status === "published" || saved?.status === "rejected";
  const needsApproval = summary.you.needs_approval;

  // The run to follow: the one started here, else one holding the post (a teammate's, or started before). The page
  // polls the location's active runs (`useActivePostRuns(locationId)` on AI Posts and the Posts page): the editor
  // reads that list, so a run is never polled twice; it asks for a fresh list once when it opens (a run started
  // elsewhere since the last poll shows at once).
  const postId = saved?.post_id ?? null;
  const pageRuns = useActivePostRuns(locationId, { enabled: false });
  const queryClient = useQueryClient();
  useEffect(() => {
    const key = activePostRunsKey(locationId);
    const state = queryClient.getQueryState(key);
    // Unless a poll just read it (or is reading it now): the page polls every 3 s while a run works.
    if (state?.fetchStatus === "fetching" || (state && Date.now() - state.dataUpdatedAt < RUN_POLL_MS)) return;
    void queryClient.invalidateQueries({ queryKey: key, exact: true });
  }, [queryClient, locationId]);
  const heldRuns = postId ? pageRuns.runs.filter((entry) => entry.post_id === postId) : [];
  const followId = runId ?? heldRuns[0]?.run_id ?? null;
  // Polled by its own id only while the page's list doesn't have it (just started, or already ended).
  const inList = followId ? pageRuns.runs.some((entry) => entry.run_id === followId) : false;
  const followed = useAiRun(locationId, followId, { poll: !inList });
  const activeRun = followed.run && runIsActive(followed.run) ? followed.run : null;
  // A series post its series is writing: nothing to poll but the post itself.
  const seriesSlot = saved?.ai_run?.kind === "series_slot";
  const slot = usePost(locationId, postId, seriesSlot, { refetchMs: seriesSlot ? SLOT_POLL_MS : false });
  const slotWritten = seriesSlot && slot.data && slot.data.ai_run?.kind !== "series_slot" ? slot.data : null;
  // "Write with AI" and Generate next write the text, type, button, dates, offer and photo: locked until they end.
  const writing = activeRun !== null && (activeRun.kind === "draft" || activeRun.kind === "series_next");
  const fieldsLocked = writing || (seriesSlot && !slotWritten);
  const aiBusy = aiStarting || activeRun !== null || fieldsLocked;

  const defaults = fromPost(null, summary.settings);
  const inputJson = JSON.stringify(toInput(form));
  const dirty = saved ? inputJson !== JSON.stringify(toInput(fromPost(saved, summary.settings))) : false;
  const hasText = form.summary.trim().length > 0;
  /** A new post worth saving before "Write with AI" fills it: its photo and button stay. */
  const newWithContent = !saved && (form.media !== null || form.ctaType !== defaults.ctaType || form.ctaUrl.trim() !== defaults.ctaUrl.trim());
  const aiMode: "write" | "change" = hasText ? "change" : "write";
  const writeSavesFirst = saved ? dirty : newWithContent;
  const textSavesFirst = !saved || dirty;
  // A new "Schedule for" time: only scheduling applies it (a scheduled post's Save draft schedules it again).
  const timeChanged = !onGoogle && scheduleAt !== scheduleStart;
  /**
   * What closing would lose: a saved post's form differs from the post, or a new post's from the empty form; or a new
   * "Schedule for" time.
   */
  const unsaved = (saved ? dirty : inputJson !== JSON.stringify(toInput(defaults))) || timeChanged;

  // Leaving the page with unsaved changes (a toast's "Buy tokens", Back) asks the same as closing it; while it saves,
  // leaving waits for the save without asking (`run`), then goes on. One blocker per page: the editor is the only one
  // on the posts pages.
  const leaving = useBlocker(({ currentLocation, nextLocation }) => (unsaved || busy !== null) && currentLocation.pathname !== nextLocation.pathname);
  // Read by `run` once its call ends (its own render's `leaving` is older by then).
  const leavingRef = useRef(leaving);
  useLayoutEffect(() => {
    leavingRef.current = leaving;
  });
  // Set by "Discard" (or `run`) while leaving, so the question's own close doesn't reset the blocker: for Back the
  // router replays the navigation a moment after `proceed()`, and a reset in between would block it again.
  const proceedingRef = useRef(false);
  useEffect(() => {
    if (leaving.state === "unblocked") proceedingRef.current = false;
  }, [leaving.state]);
  // A save that ended with nothing left unsaved (e.g. a refused schedule after its save): the page it held goes on.
  useEffect(() => {
    if (leaving.state !== "blocked" || busy !== null || unsaved || proceedingRef.current) return;
    proceedingRef.current = true;
    leaving.proceed?.();
  }, [leaving, busy, unsaved]);
  // Closing the tab or reloading with unsaved changes (or while it saves): the browser's own question.
  useEffect(() => {
    if (!unsaved && busy === null) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved, busy]);

  /** Puts a post in the form (the AI's, a reloaded one) and makes it the new starting point. */
  const loadForm = (next: Post) => {
    const nextForm = fromPost(next, summary.settings);
    setForm(nextForm);
    setBaseline(JSON.stringify(toInput(nextForm)));
    setStartMediaId(nextForm.media?.media_id ?? null);
    setAiVersion(null);
    setCheckFindings([]);
    setTouched(true);
    setTimeNote(false);
    if (next.scheduled_at) {
      const at = localInputValue(new Date(next.scheduled_at));
      setScheduleAt(at);
      setScheduleStart(at);
    }
  };

  /** Takes a post the AI saved: into the form when nobody changed the form meanwhile, else offered next to it. */
  const receive = (next: Post) => {
    setSaved(next);
    setIssues(next.issues);
    setWarnings(next.warnings);
    if (inputJson === baseline) loadForm(next);
    else setAiVersion(next);
  };

  useOnRunEnd(locationId, [followId], (finished) => {
    setRunId((current) => (current === finished.run_id ? null : current));
    setEndedRun(finished);
    if (finished.status !== "done" || !finished.result) return;
    if (finished.kind === "image") {
      const picture = finished.result.media;
      if (!picture) return;
      if (finished.result.attached && finished.result.post) {
        // It replaced the post's photo through the normal edit.
        setSaved(finished.result.post);
        setForm((current) => ({ ...current, media: picture }));
      } else if (!finished.post_id && (form.media?.media_id ?? null) === startMediaId) {
        // A picture asked from a description is never attached: it goes in the form, as an upload would.
        setForm((current) => ({ ...current, media: picture }));
      }
      return;
    }
    if (finished.kind === "plan") return;
    const next = finished.result.post;
    if (next) receive(next);
  });

  const reloadPost = async () => {
    invalidate();
    if (!saved) return;
    try {
      const fresh = await getPost(locationId, saved.post_id);
      setSaved(fresh);
      setIssues(fresh.issues);
      setWarnings(fresh.warnings);
      loadForm(fresh);
      setEndedRun(null);
    } catch (err) {
      toastError(err, "The post couldn't be reloaded.");
    }
  };

  /** Takes the post its series wrote. */
  const takeSlotPost = (next: Post) => {
    setSaved(next);
    setIssues(next.issues);
    setWarnings(next.warnings);
    loadForm(next);
  };
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
  // The location's post rules come in plain words (lodging, and Phase 25c's regulated products and services).
  const issues = (validation.data?.issues ?? savedIssues).map((issue) => {
    const words = POST_RULE_WORDS[issue.code];
    return words ? { ...issue, message: words } : issue;
  });
  const warnings = validation.data?.warnings ?? savedWarnings;
  // A schedule-time problem blocks Schedule, not Publish now.
  const incomplete = validation.data ? !validation.data.complete : false;
  const blocksPublish = issues.some((issue) => issue.field !== "scheduled_at");
  // No Offer posts for lodging or a regulated business: the live check says so for an Offer post, the AI facts
  // say it for the location (so the button stays off once another type is picked).
  const offerRule = issues.find((issue) => OFFER_RULE_CODES.has(issue.code)) ?? null;
  const offersRefused = facts.data?.offers.allowed === false ? facts.data.offers : null;
  const offerRefusal = offerRule
    ? offerRule.message
    : offersRefused
      ? (POST_RULE_WORDS[offersRefused.reason ?? ""] ?? "Offer posts aren't allowed for this business. Use an Update or Event post.")
      : null;
  // Post writer v2: the checks' findings on the AI's text (and a refused schedule's). A hard one that still stands
  // blocks Schedule and Publish (the backend's rule, `standingHardFindings`): words while they are in the text; a
  // whole-text one until a person changes the AI's text (an unsaved change counts: the save first records it).
  const aiFindings = mergeFindings(saved?.ai?.findings, checkFindings);
  // As the save compares it (`changedFields`): a change of the text the PATCH will carry, which records `ai.edited`.
  const textChanged = saved ? (form.summary.trim() || null) !== (saved.summary?.trim() || null) : false;
  const standing: StandingContext = { summary: form.summary, type: form.type, edited: textChanged ? true : saved?.ai?.edited };
  const hardLeft = standingHardFindings({ findings: aiFindings, edited: saved?.ai?.edited }, standing);
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
    fieldsLocked ? "Wait for the AI to finish writing this post." : null,
    contentBlocked ? (touched ? `Fix the issues above to ${actionVerb}.` : `Write your post to ${actionVerb}.`) : null,
    hardLeft.length && !contentBlocked ? `Change the words marked “Must change” to ${actionVerb}.` : null,
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
    // 422 `post_incomplete` lists what blocks it (the post rules included); 422 `checks_failed` the AI text's findings.
    const refused = incompleteIssues(err);
    if (refused.length) setIssues(refused);
    const found = checksFailedFindings(err);
    if (found.length) setCheckFindings(found);
    setTouched(true);
    toastError(err, fallback, {
      onReload: () => {
        invalidate();
        onClose();
      },
    });
  };

  /**
   * Saves the form (create as a draft, or PATCH the changes) and returns the saved post. An unchanged saved post
   * sends nothing (the backend refuses an empty PATCH with 400 `invalid_input`): Schedule and Publish then go
   * straight to their own call, e.g. for a fresh "Write with AI" draft nobody edited.
   */
  const save = async (): Promise<Post> => {
    const input = toInput(form);
    if (saved) {
      const patch = changedFields(input, saved);
      if (Object.keys(patch).length === 0) return saved;
      const result = await updatePost(locationId, saved.post_id, patch);
      setSaved(result);
      setIssues(result.issues);
      setWarnings(result.warnings);
      return result;
    }
    const result = await createPost(locationId, { ...input, action: "draft" });
    setSaved(result);
    setIssues(result.issues);
    setWarnings(result.warnings);
    return result;
  };

  // The button pressed (Save draft, Schedule, Publish now) is off while it saves, which drops the focus out of the
  // editor: when the save ends with the editor still open (it failed, or left issues), the focus goes back to it, and a
  // question asked then ("Discard your changes?" after Back) returns there on "Keep editing".
  const pressedRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (busy !== null) return;
    const pressed = pressedRef.current;
    pressedRef.current = null;
    const active = document.activeElement;
    if (pressed?.isConnected && (!active || active === document.body)) pressed.focus({ preventScroll: true });
  }, [busy]);

  /** Saves (or schedules, publishes, sends for approval): the form takes no input meanwhile, so nothing typed is lost. */
  const run = async (key: string, action: () => Promise<Post | void>, done: (post: Post | void) => string) => {
    const active = document.activeElement;
    pressedRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
    setBusy(key);
    try {
      const result = await action();
      invalidate();
      toast.success(done(result));
      if (result && (result.status === "failed" || result.status === "rejected")) {
        toast.error(postProblemWords(result)?.text ?? "Google didn't accept the post.", { description: "The post is kept; fix it and try again." });
      }
      // Saved: the page the person left for meanwhile (Back while it saved) goes on, before closing drops the blocker.
      const held = leavingRef.current;
      if (held.state === "blocked") {
        proceedingRef.current = true;
        held.proceed?.();
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
  /**
   * "Save draft". The PATCH can't carry a time (only `schedule` sets one): a scheduled post with a new "Schedule for"
   * time is saved, then scheduled again for it, as Schedule would. Elsewhere (a draft, a failed or waiting post, a
   * time that can't be scheduled, or someone who needs approval: rescheduling would send it for approval) a new time
   * that is the only change isn't saved: nothing is sent, nothing says "Saved.", and the editor stays open saying how
   * to use the time.
   */
  const saveDraft = () => {
    const at = scheduleIso;
    if (timeChanged && saved?.status === "scheduled" && !needsApproval && at && !incomplete && hardLeft.length === 0) {
      const post = saved;
      return run("save", async () => {
        await save();
        return schedulePost(locationId, post.post_id, at);
      }, outcome);
    }
    if (timeChanged && saved && !dirty) {
      setTimeNote(true);
      return;
    }
    // A saved post with nothing changed sends nothing and closes as after a save ("Saved.").
    return run("save", save, (result) => (saved && !dirty ? "Saved." : outcome(result)));
  };

  /**
   * Starts an AI run: saves the form first when asked (the AI works on the saved post), then follows the run. A
   * request declined whole comes back inline (nothing spent); other errors are toasted.
   */
  const startAi = async (options: { saveFirst: boolean; fallback: string }, makeStart: (postId: string | null) => (() => Promise<PostAiRunStart>) | null) => {
    setAiStarting(true);
    setDeclined(null);
    setEndedRun(null);
    setAiVersion(null);
    try {
      let id = saved?.post_id ?? null;
      if (options.saveFirst) id = (await save()).post_id;
      const start = makeStart(id);
      if (!start) return;
      const outcome = await starter.mutateAsync({ start, fallback: options.fallback, onReload: () => void reloadPost() });
      if (outcome.kind === "started" || outcome.kind === "busy") {
        setRunId(outcome.run.run_id);
        setBaseline(JSON.stringify(toInput(form)));
        setStartMediaId(form.media?.media_id ?? null);
        if (outcome.kind === "started" && outcome.existing) toast.info("This is already running", { description: "It shows here until it's done." });
      } else if (outcome.kind === "inline") {
        setDeclined(outcome.error);
      }
    } catch (err) {
      // Only the save can throw here (the start never does).
      fail(err, "Your changes couldn't be saved, so the AI didn't start.");
    } finally {
      setAiStarting(false);
    }
  };

  const writeWithAi = (input: AiDraftInput) =>
    void startAi({ saveFirst: writeSavesFirst, fallback: "The post couldn't be started" }, (id) => () => aiDraftPost(locationId, { ...input, ...(id ? { post_id: id } : {}) }));
  const changeWithAi = (input: AiReviseInput) =>
    void startAi({ saveFirst: textSavesFirst, fallback: "The change couldn't be started" }, (id) => (id ? () => aiRevisePost(locationId, id, input) : null));
  /** From the post's text (`post_id`: it replaces the post's photo) or from a description (it goes in the form). */
  const createPicture = ({ hint, style }: { hint: string; style: AiImageStyle | null }) => {
    const styled = style ? { style } : {};
    if (hint.trim()) {
      void startAi({ saveFirst: false, fallback: "The picture couldn't be started" }, () => () => aiPostImage(locationId, { prompt_hint: hint.trim(), ...styled }));
    } else {
      void startAi({ saveFirst: textSavesFirst, fallback: "The picture couldn't be started" }, (id) => (id ? () => aiPostImage(locationId, { post_id: id, ...styled }) : null));
    }
  };
  const restart = endedRun?.status === "failed" ? retryStartOf(locationId, endedRun) : null;
  const retryRun = restart ? () => void startAi({ saveFirst: false, fallback: "That couldn't be started" }, () => restart) : undefined;

  /** "Show in the text": selects a finding's words in the text box. */
  const showFinding = (finding: PostAiFinding) => {
    const range = locateFinding(form.summary, finding);
    const box = textRef.current;
    if (!range || !box) return;
    box.focus();
    box.setSelectionRange(range.start, range.end);
  };

  const showAiPanel = !onGoogle && saved?.status !== "publishing" && !(seriesSlot && !slotWritten);
  const pictureRun = activeRun?.kind === "image" ? activeRun : null;
  const pictureEnded = endedRun?.kind === "image" && endedRun.status === "done" ? endedRun : null;

  // The person closes it (the X, Escape, a click outside, Cancel): with unsaved changes it asks first. Busy can't close.
  const [confirmingClose, setConfirmingClose] = useState(false);
  const requestClose = () => {
    if (busy) return;
    if (unsaved) setConfirmingClose(true);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : requestClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {saved ? "Edit post" : "New post"}
            {(saved?.source ?? form.source) === "ai" ? (
              <StatusBadge tone="ai" icon={Sparkles} size="sm">
                Written with AI
              </StatusBadge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {onGoogle
              ? "This post is on Google: saving updates it there (only the changed fields)."
              : saved?.source === "ai"
                ? "Read it through and make it yours, then save, schedule or publish it."
                : "Write the post, then save it as a draft, schedule it or publish it now."}
          </DialogDescription>
        </DialogHeader>

        {!summary.connection.gbp_connected ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            Connect this location to Google to publish. You can still write and save drafts.
          </p>
        ) : null}

        {/* While it saves (schedules, publishes, sends for approval) nothing in the form takes input: the editor closes
            when the call ends, and words typed meanwhile would be lost. */}
        <fieldset disabled={busy !== null} aria-busy={busy !== null || undefined} className="min-w-0 space-y-5">
          {activeRun && activeRun.kind !== "image" ? (
            <RunProgress run={activeRun}>
              <p className="mt-1 text-xs text-muted-foreground">
                {writing
                  ? "The text, type, button, dates and photo stay locked until it's done. You can close this window: the post fills in by itself."
                  : "You can keep editing. Saving your own changes now keeps your version, and the AI's change is dropped."}
              </p>
            </RunProgress>
          ) : seriesSlot && !slotWritten ? (
            <SeriesSlotProgress variant="panel" />
          ) : null}
          {slotWritten ? (
            <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-ai/25 bg-ai-surface/60 px-3 py-2.5">
              <p className="min-w-0 flex-1 text-sm text-foreground">Its series wrote this post.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => takeSlotPost(slotWritten)}>
                Show it
              </Button>
            </div>
          ) : null}
          {endedRun?.status === "failed" ? (
            <RunFailure
              run={endedRun}
              locationId={locationId}
              newTab
              fallback={RUN_FAILED_TITLE[endedRun.kind]}
              onRetry={retryRun}
              onReload={saved ? () => void reloadPost() : undefined}
              onDismiss={() => setEndedRun(null)}
            />
          ) : endedRun && runNotes(endedRun) ? (
            <div className="flex items-start gap-2 rounded-lg border border-ai/25 bg-ai-surface/50 px-3 py-2.5">
              <RunNotes locationId={locationId} run={endedRun} newTab onUsePicture={(picture) => set("media", picture)} className="min-w-0 flex-1" />
              <DismissButton onDismiss={() => setEndedRun(null)} />
            </div>
          ) : null}
          {aiVersion ? (
            <div role="status" className="flex flex-col gap-2 rounded-lg border border-ai/25 bg-ai-surface/60 px-3 py-2.5 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-sm text-foreground">
                <span className="font-medium">The AI's version is ready.</span> You changed the post meanwhile, so yours is still shown. Saving keeps
                yours.
              </p>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" size="sm" variant="ai" onClick={() => loadForm(aiVersion)}>
                  Show the AI's version
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAiVersion(null)}>
                  Keep mine
                </Button>
              </div>
            </div>
          ) : null}
          {declined ? <DeclinedNotice error={declined} locationId={locationId} newTab /> : null}

          <Field label="Post type" labelId={fieldId("type-label")}>
            <div role="group" aria-labelledby={fieldId("type-label")} className="flex flex-wrap gap-2">
              {(["standard", "event", "offer"] as const).map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant={form.type === type ? "default" : "outline"}
                  disabled={fieldsLocked || (onGoogle && form.type !== type) || (type === "offer" && offerRefusal !== null && form.type !== "offer")}
                  title={
                    onGoogle && form.type !== type
                      ? "A published post's type can't change; duplicate it instead"
                      : type === "offer" && offerRefusal
                        ? offerRefusal
                        : undefined
                  }
                  onClick={() => set("type", type)}
                >
                  {type === "standard" ? "Update" : type === "event" ? "Event" : "Offer"}
                </Button>
              ))}
            </div>
            {offerRefusal && !offerRule ? <p className="text-xs text-muted-foreground">{offerRefusal}</p> : null}
          </Field>

          {showAiPanel ? (
            <EditorAiPanel
              locationId={locationId}
              ai={ai}
              mode={aiMode}
              defaultOpen={aiOpen}
              starting={aiStarting}
              locked={aiBusy}
              type={form.type}
              savesFirst={aiMode === "write" ? writeSavesFirst : textSavesFirst}
              onWrite={writeWithAi}
              onChange={changeWithAi}
            />
          ) : null}
          {fieldsLocked ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock aria-hidden className="size-3.5 shrink-0" /> Locked while the AI writes this post.
            </p>
          ) : null}

          {form.type !== "standard" ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Field label={`${form.type === "event" ? "Event" : "Offer"} title`} htmlFor={fieldId("title")} issues={issueFor("event.title")}>
                <Input
                  {...fieldProps(fieldId("title"), issueFor("event.title"), fieldId("title-count"))}
                  value={form.title}
                  maxLength={TITLE_MAX}
                  disabled={fieldsLocked}
                  onChange={(event) => set("title", event.target.value)}
                />
                <Counter id={fieldId("title-count")} value={form.title.length} max={TITLE_MAX} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Starts" htmlFor={fieldId("start")} issues={issueFor("event.start")}>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      {...fieldProps(fieldId("start"), issueFor("event.start"))}
                      value={form.startDate}
                      disabled={fieldsLocked}
                      onChange={(event) => set("startDate", event.target.value)}
                    />
                    <Input
                      type="time"
                      aria-label="Start time (optional)"
                      aria-describedby={issueFor("event.start").length ? issuesId(fieldId("start")) : undefined}
                      value={form.startTime}
                      disabled={fieldsLocked}
                      onChange={(event) => set("startTime", event.target.value)}
                    />
                  </div>
                </Field>
                <Field label="Ends" htmlFor={fieldId("end")} issues={issueFor("event.end")}>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      {...fieldProps(fieldId("end"), issueFor("event.end"))}
                      value={form.endDate}
                      disabled={fieldsLocked}
                      onChange={(event) => set("endDate", event.target.value)}
                    />
                    <Input
                      type="time"
                      aria-label="End time (optional)"
                      aria-describedby={issueFor("event.end").length ? issuesId(fieldId("end")) : undefined}
                      value={form.endTime}
                      disabled={fieldsLocked}
                      onChange={(event) => set("endTime", event.target.value)}
                    />
                  </div>
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">Dates are the location's local dates. Without a time, it covers the whole day.</p>
              <RecurrenceFields form={form} set={set} issues={issueFor("recurrence")} disabled={fieldsLocked || busy !== null} />
            </div>
          ) : null}

          <Field label="Text" htmlFor={fieldId("summary")} issues={issueFor("summary")}>
            <Textarea
              ref={textRef}
              {...fieldProps(fieldId("summary"), issueFor("summary"), fieldId("summary-count"))}
              rows={6}
              maxLength={SUMMARY_MAX}
              value={form.summary}
              disabled={fieldsLocked}
              onChange={(event) => set("summary", event.target.value)}
            />
            <Counter id={fieldId("summary-count")} value={form.summary.length} max={SUMMARY_MAX} />
            {saved?.ai ? <PostAiFacts ai={saved.ai} /> : null}
            {aiFindings.length ? (
              <div className="rounded-lg border border-border bg-surface-strong px-3 py-2.5">
                <PostFindingsList
                  findings={aiFindings}
                  text={form.summary}
                  context={standing}
                  onShow={showFinding}
                  caption={
                    hardLeft.length
                      ? "What our checks found in the AI's text. The words marked “Must change” have to change before the post goes out."
                      : "What our checks found in the AI's text."
                  }
                />
              </div>
            ) : null}
          </Field>

          {form.type === "offer" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Coupon code (optional)" htmlFor={fieldId("coupon")} issues={issueFor("offer.coupon_code")}>
                <Input
                  {...fieldProps(fieldId("coupon"), issueFor("offer.coupon_code"))}
                  value={form.coupon}
                  disabled={fieldsLocked}
                  onChange={(event) => set("coupon", event.target.value)}
                />
              </Field>
              <Field label="Redeem online (optional, https)" htmlFor={fieldId("redeem")} issues={issueFor("offer.redeem_url")}>
                <Input
                  type="url"
                  {...fieldProps(fieldId("redeem"), issueFor("offer.redeem_url"))}
                  value={form.redeemUrl}
                  disabled={fieldsLocked}
                  onChange={(event) => set("redeemUrl", event.target.value)}
                />
              </Field>
              <Field label="Terms (optional)" htmlFor={fieldId("terms")} className="sm:col-span-2" issues={issueFor("offer.terms")}>
                <Textarea
                  rows={2}
                  {...fieldProps(fieldId("terms"), issueFor("offer.terms"))}
                  value={form.terms}
                  disabled={fieldsLocked}
                  onChange={(event) => set("terms", event.target.value)}
                />
              </Field>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
              <Field label="Button" htmlFor={fieldId("cta")} issues={ctaIssues}>
                {/* Off by its own prop too: a disabled fieldset doesn't stop the mouse press that opens a Radix Select. */}
                <Select value={form.ctaType} disabled={fieldsLocked || busy !== null} onValueChange={(value) => set("ctaType", value as Form["ctaType"])}>
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
                    disabled={fieldsLocked}
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
            issues={issueFor("media")}
            disabled={fieldsLocked}
            picture={
              showAiPanel
                ? {
                    ai,
                    fromText: hasText,
                    savesFirst: textSavesFirst,
                    busy: aiBusy,
                    starting: aiStarting,
                    run: pictureRun,
                    ended: pictureEnded,
                    onCreate: createPicture,
                    onDismiss: () => setEndedRun(null),
                  }
                : null
            }
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
                onChange={(event) => {
                  setScheduleAt(event.target.value);
                  setTimeNote(false);
                }}
              />
            </Field>
          ) : null}
        </fieldset>

        <DialogFooter className="gap-2 sm:items-end sm:justify-between">
          <Button variant="ghost" onClick={requestClose} disabled={busy !== null}>Cancel</Button>
          <div className="flex min-w-0 flex-col gap-2 sm:items-end">
            {/* Always there (out of sight when empty), so screen readers hear the note when it shows. */}
            <p role="status" className={timeNote ? "text-xs font-medium text-foreground sm:text-right" : "sr-only"}>
              {timeNote ? `Save draft doesn't keep the new time. To use it, select “${needsApproval ? "Send for approval" : "Schedule"}”.` : ""}
            </p>
            {!onGoogle && blockedReasons.length > 0 ? <p className="text-xs text-muted-foreground sm:text-right">{blockedReasons.join(" ")}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy !== null || fieldsLocked || aiStarting} onClick={() => void saveDraft()}>
                {busy === "save" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                {onGoogle ? "Save on Google" : "Save draft"}
              </Button>
              {!onGoogle ? (
                <>
                  <Button
                    variant="outline"
                    disabled={busy !== null || fieldsLocked || aiStarting || !scheduleIso || incomplete || hardLeft.length > 0}
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
                          : hardLeft.length
                            ? "Change the words marked “Must change” first"
                            : undefined
                    }
                    onClick={() => void doSchedule()}
                  >
                    {busy === "schedule" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                    {needsApproval ? "Send for approval" : "Schedule"}
                  </Button>
                  <Button
                    disabled={busy !== null || fieldsLocked || aiStarting || !summary.connection.gbp_connected || contentBlocked || hardLeft.length > 0}
                    title={
                      contentBlocked
                        ? touched
                          ? "Fix the issues listed above first"
                          : "Write the post first"
                        : hardLeft.length
                          ? "Change the words marked “Must change” first"
                          : !summary.connection.gbp_connected
                            ? "Connect Google first"
                            : undefined
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
        {/* "Keep editing" has the focus when it opens (Radix focuses an alert dialog's Cancel). Not while it saves. */}
        <ConfirmDialog
          open={confirmingClose || (leaving.state === "blocked" && busy === null)}
          onOpenChange={(open) => {
            if (open) return;
            setConfirmingClose(false);
            if (leaving.state === "blocked" && !proceedingRef.current) leaving.reset?.();
          }}
          title="Discard your changes?"
          description={saved ? "The changes you made to this post aren't saved." : "This post isn't saved yet."}
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={() => {
            if (leaving.state === "blocked") {
              proceedingRef.current = true;
              leaving.proceed?.();
              return;
            }
            setConfirmingClose(false);
            onClose();
          }}
        />
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

function RecurrenceFields({
  form,
  set,
  issues,
  disabled = false,
}: {
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
  issues: PostIssue[];
  disabled?: boolean;
}) {
  const issuesElementId = useId();
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={form.repeats} disabled={disabled} onCheckedChange={(value) => set("repeats", value === true)} /> Repeats
      </label>
      {form.repeats ? (
        <div
          role="group"
          aria-label="How it repeats"
          aria-describedby={issues.length > 0 ? issuesElementId : undefined}
          className="space-y-3 rounded-md bg-surface-strong p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            {/* Each Select is off by its own prop: the fieldset doesn't stop the mouse press that opens one. */}
            <Select value={form.pattern} disabled={disabled} onValueChange={(value) => set("pattern", value as PostRecurrence["pattern"])}>
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
              <Select value={form.monthlyBy} disabled={disabled} onValueChange={(value) => set("monthlyBy", value as Form["monthlyBy"])}>
                <SelectTrigger className="w-48" aria-label="Which day of the month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">On day of month</SelectItem>
                  <SelectItem value="week">On the n-th weekday</SelectItem>
                </SelectContent>
              </Select>
              {form.monthlyBy === "day" ? (
                <Input type="number" min={1} max={31} className="w-20" aria-label="Day of the month" value={form.dayOfMonth} onChange={(event) => set("dayOfMonth", event.target.value)} />
              ) : (
                <Select value={form.weekOfMonth} disabled={disabled} onValueChange={(value) => set("weekOfMonth", value as WeekOfMonth)}>
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
    </fieldset>
  );
}

/** "Create a picture" in the editor: the editor starts and follows the run. */
type PictureControls = {
  ai: PostAiState;
  /** The post has text: an empty description makes the picture from it (`post_id`). */
  fromText: boolean;
  /** The form is saved first for a picture from the text. */
  savesFirst: boolean;
  /** Another AI run works on the post, or one is starting. */
  busy: boolean;
  starting: boolean;
  /** A picture run working now. */
  run: PostAiRun | null;
  /** The last picture run that finished. */
  ended: PostAiImageRun | null;
  onCreate: (choice: { hint: string; style: AiImageStyle | null }) => void;
  onDismiss: () => void;
};

/**
 * One photo: upload (cropped to 4:3), pick from the gallery, or create one with AI (Phase 25c: a photo from the
 * library that fits, that photo enhanced, or an AI image). A picture's label says what it is ("AI-generated
 * image, not a photo of your business", "Enhanced from your photo"); an enhanced one can go back to the original.
 */
function PhotoField({
  locationId,
  media,
  onChange,
  photosPublishable,
  issues,
  disabled = false,
  picture,
}: {
  locationId: string;
  media: PostMedia | null;
  onChange: (media: PostMedia | null) => void;
  photosPublishable: boolean;
  issues: PostIssue[];
  /** "Write with AI" is writing the post: the photo is the AI's to set. */
  disabled?: boolean;
  /** AI pictures (a post not on Google yet); null: not offered. */
  picture: PictureControls | null;
}) {
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
  const fileInput = useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const gallery = usePostMedia(locationId, galleryOpen);
  const photos = gallery.data?.pages.flatMap((page) => page.media) ?? [];
  const [uploading, setUploading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [hint, setHint] = useState("");
  const [style, setStyle] = useState<AiImageStyle | "auto">("auto");
  const [removing, setRemoving] = useState<string | null>(null);
  const photoId = useId();

  // An enhanced picture can go back to the library photo it was made from (`source_media_id`).
  const label = mediaLabel(media);
  const enhanced = media?.kind === "enhanced";
  const ownSource = media ? (media as Partial<PostMediaDetails>).source_media_id : undefined;
  const details = useMediaDetails(locationId, media?.media_id, enhanced && ownSource === undefined);
  const sourceId = enhanced ? (ownSource ?? details.data?.source_media_id ?? null) : null;
  const library = useLibraryPhotos(locationId, Boolean(sourceId));
  const original = sourceId ? (library.data?.find((photo) => photo.media_id === sourceId) ?? null) : null;

  const ai = picture?.ai ?? null;
  const hintText = hint.trim();
  const pictureReady = hintText.length >= PICTURE_HINT_MIN || (Boolean(picture?.fromText) && hintText.length === 0);
  const ended = picture?.ended ?? null;
  const endedResult = ended?.result ?? null;
  const endedApplied = Boolean(endedResult?.media && media?.media_id === endedResult.media.media_id);

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
        <div className="flex flex-wrap items-start gap-3">
          <figure className="w-56 max-w-full">
            <div className="relative overflow-hidden rounded-lg border border-border">
              <img src={media.url} alt="" className="aspect-[4/3] w-full object-cover" />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="absolute right-1.5 top-1.5 size-9"
                aria-label="Remove photo"
                disabled={disabled}
                onClick={() => onChange(null)}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
            {label ? (
              <figcaption className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
                <Sparkles aria-hidden className="mt-px size-3 shrink-0 text-ai" /> {label}
              </figcaption>
            ) : null}
          </figure>
          {original ? (
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange(original)}>
              <Undo2 aria-hidden /> Use the original photo
            </Button>
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
        <Button type="button" size="sm" variant="outline" disabled={uploading || disabled} onClick={() => fileInput.current?.click()}>
          {uploading ? <LoaderCircle aria-hidden className="animate-spin" /> : <Upload aria-hidden />} Upload
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} aria-expanded={galleryOpen} onClick={() => setGalleryOpen((value) => !value)}>
          <ImagePlus aria-hidden /> From gallery
        </Button>
        {picture && ai ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-ai hover:border-ai/40 hover:bg-ai-surface hover:text-ai"
            aria-expanded={aiOpen}
            disabled={!ai.canRun || disabled}
            title={ai.reason}
            onClick={() => setAiOpen((value) => !value)}
          >
            <Sparkles aria-hidden /> Create a picture
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        JPEG or PNG, at least 250×250, up to 5 MB, cropped to 4:3. Real photos of your business work best on Google. Photos no post uses are deleted
        after 30 days, except those in your{" "}
        <a
          href={locationPath(locationId, "ai/photos")}
          target="_blank"
          rel="noreferrer"
          className="rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          photo library<span className="sr-only"> (opens in a new tab)</span>
        </a>
        .
      </p>
      {picture && ai && !ai.canRun && ai.reason ? <p className="text-xs text-muted-foreground">AI pictures: {ai.reason}</p> : null}
      {picture?.run ? <RunProgress run={picture.run} /> : null}
      {picture && ended && endedResult ? (
        <div className="flex items-start gap-2 rounded-lg border border-ai/25 bg-ai-surface/50 px-3 py-2.5">
          {endedApplied ? (
            <p className="min-w-0 flex-1 text-sm text-foreground">
              {endedResult.attached ? "The new picture is on the post." : "The new picture is in the post. Save to keep it."}
              {logoSkippedText(endedResult.logo, endedResult.reasons) ? ` ${logoSkippedText(endedResult.logo, endedResult.reasons)}` : ""}
            </p>
          ) : (
            <PictureOutcome image={endedResult} onUse={disabled ? undefined : (next) => onChange(next)} className="min-w-0 flex-1" />
          )}
          <DismissButton onDismiss={picture.onDismiss} />
        </div>
      ) : null}
      {picture && ai && aiOpen && ai.canRun ? (
        <div className="space-y-2.5 rounded-lg border border-ai/25 bg-ai-surface/50 p-3">
          <Input
            aria-label={picture.fromText ? "Describe the picture (optional)" : "Describe the picture"}
            placeholder={
              picture.fromText ? "Describe it, or leave empty for a picture that fits the post's text" : "Describe the picture, e.g. fresh loaves on a wooden table"
            }
            maxLength={PICTURE_HINT_MAX}
            value={hint}
            disabled={picture.busy}
            onChange={(event) => setHint(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={style} disabled={picture.busy} onValueChange={(value) => setStyle(value as AiImageStyle | "auto")}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Your photo first, else an AI photo</SelectItem>
                {STYLE_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STYLE_LABEL[value]}
                    {STOCK_ART_STYLES.has(value) ? " (may look like stock art)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="ai"
              disabled={picture.busy || !pictureReady}
              title={picture.busy ? "Wait for the AI to finish" : !pictureReady ? `Describe the picture in at least ${PICTURE_HINT_MIN} characters` : undefined}
              onClick={() => picture.onCreate({ hint, style: style === "auto" ? null : style })}
            >
              {picture.starting ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} Create
              <AiCostChip tokens={ai.imageCost} variant="inverse" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {style === "auto"
              ? "A photo from your library when one fits, free; else an AI image at the price shown. "
              : "A style always makes an AI image. "}
            AI images never contain words, logos or brand names, and are labelled as AI-generated.
            {style !== "auto" && STOCK_ART_STYLES.has(style) ? " This style may look like stock art; Google prefers real photos." : ""}
            {picture.fromText && !hintText && picture.savesFirst ? " Your changes are saved first." : ""}
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
                    disabled={disabled}
                    aria-label={`${media?.media_id === item.media_id ? "Chosen photo" : "Use this photo"}${item.label ? ` (${item.label})` : ""}`}
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
