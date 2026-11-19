import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, CirclePause, Info, LoaderCircle, Sparkles } from "lucide-react";
import { createPostSeries, updatePostSeries, type CtaType, type PostSeries, type PostTone, type SeriesCadence, type SeriesPublishMode, type SeriesTopicMode } from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/use-access";
import { formatTokens } from "@/lib/ai/ai-costs";
import type { AiStatus } from "@/lib/ai/ai-status";
import { autoPublishSwitchText } from "@/lib/posts/approval-labels";
import { useToastSeriesError } from "@/lib/posts/series-errors";
import {
  SERIES_DEFAULT_NAME,
  SERIES_FIELD_LIMITS,
  browserTimeZone,
  createInput,
  newSeriesForm,
  patchInput,
  postsReleasedText,
  releasesPosts,
  sameKeywords,
  seriesFormFrom,
  seriesFormProblems,
  seriesFormSummary,
  seriesPublishMode,
  type SeriesButton,
  type SeriesForm,
} from "@/lib/posts/series-form";
import { plannerPausedReason, seriesPlanner, type PausedPlanner } from "@/lib/posts/series-planner";
import { CTA_LABEL, TONE_LABEL, WEEKDAYS, useInvalidatePosts } from "@/lib/posts/use-posts";
import { useTracking } from "@/lib/rankings/use-rankings";
import { cn } from "@/lib/utils";

const OTHER_ZONE = "__other__";

/**
 * Create or edit an auto-post series (Phase 25c). A new series opens with the server's own defaults for `POST
 * …/post-series {}` ("AI posts", weekly on one weekday two days ahead at 10:00, starting today, topics planned by AI,
 * every tracked keyword, each post waiting for review, a picture, the button chosen for each post) and sends only
 * what the user changed. An edit sends only the changed fields; when they touch the schedule or the content, the
 * posts the series already wrote for upcoming dates go back to drafts (`posts_released`), which the dialog says
 * before saving and the toast counts after.
 *
 * "Publishes on its own" (`publish_mode: auto`) is offered only while automatic publishing is switched on for the
 * account (`autoSwitchOn`), or to a series already in that mode (so it can go back to review).
 */
export function SeriesDialog({
  locationId,
  locationZone,
  series,
  ai,
  photosPublishable,
  pausedPlanner,
  autoSwitchOn,
  onClose,
}: {
  locationId: string;
  /** The location's IANA time zone; null when unknown (the server then uses UTC). */
  locationZone: string | null;
  /** The series to edit, or null for a new one. */
  series: PostSeries | null;
  ai: AiStatus;
  photosPublishable: boolean;
  /** Automatic AI posts are paused for the account (from the series' `planner`), or null. */
  pausedPlanner: PausedPlanner | null;
  /** Automatic publishing is switched on for the account (any series' `auto_publish.switch`). */
  autoSwitchOn: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastSeriesError();
  const agency = useAccess().accountType === "agency";
  const tracking = useTracking(locationId);
  const ids = useId();
  // Mohit (2026-10-12): series times are in the user's own zone unless they pick another.
  const [userZone] = useState(browserTimeZone);
  const [form, setForm] = useState<SeriesForm>(() =>
    series ? seriesFormFrom(series) : newSeriesForm({ now: Date.now(), zone: userZone, includeImage: photosPublishable }),
  );
  const [customZone, setCustomZone] = useState(false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SeriesForm>(key: K, value: SeriesForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const problems = seriesFormProblems(form);
  const shown = tried ? problems : {};
  const zoneOptions = Array.from(new Set([userZone, ...(locationZone ? [locationZone] : []), ...(series ? [series.time_zone] : []), form.zone].filter(Boolean)));
  const tracked = (tracking.data?.tracking.keywords ?? []).map((keyword) => keyword.text);
  // Keywords the series uses that aren't tracked any more stay visible (saving them would be refused).
  const untracked = form.keywords.filter((keyword) => !tracked.some((text) => sameKeywords([text], [keyword])));
  const keywordChoices = [...tracked, ...untracked];
  const showAutoChoice = autoSwitchOn || (series ? seriesPublishMode(series) === "auto" : false);
  const switchText = autoPublishSwitchText(autoSwitchOn ? "on" : "switched_off");
  // A new series must be able to post: never let one start while AI can't run.
  const createBlocked = !series && !ai.canRun;
  const patch = series ? patchInput(form, series) : null;
  const releasing = patch ? releasesPosts(patch) : false;
  const imageCost = ai.costs.post_image;
  const perPost = ai.costs.post_draft + (form.includeImage ? imageCost : 0);

  const save = async () => {
    setTried(true);
    if (Object.keys(problems).length > 0 || saving) return;
    if (series) {
      const input = patchInput(form, series);
      if (Object.keys(input).length === 0) {
        onClose();
        return;
      }
      setSaving(true);
      try {
        const saved = await updatePostSeries(locationId, series.series_id, input);
        const released = postsReleasedText(saved.posts_released);
        toast.success("Series updated.", {
          description: released ? `${released}. AI writes them again with the new settings.` : "Changes apply to posts not written yet.",
        });
        onClose();
      } catch (err) {
        toastError(err, "The series couldn't be saved.", { onReload: invalidate });
      } finally {
        setSaving(false);
        invalidate();
      }
      return;
    }
    setSaving(true);
    try {
      const saved = await createPostSeries(locationId, createInput(form, { now: Date.now(), locationZone }));
      const goesOutAlone = seriesPublishMode(saved) === "auto" && saved.auto_publish?.switch === "on";
      toast.success(
        seriesPlanner(saved) === "on"
          ? `Auto-posts are on. The first post is written about 2 days before its time${goesOutAlone ? "." : " and waits for review."}`
          : "Series saved. Automatic AI posts are paused for now, so nothing is written on its own yet.",
      );
      onClose();
    } catch (err) {
      toastError(err, "The series couldn't be saved.", { onReload: invalidate });
    } finally {
      setSaving(false);
      invalidate();
    }
  };

  const cadenceKind = form.kind;

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{series ? "Edit auto-posts" : "New auto-post series"}</DialogTitle>
          <DialogDescription>AI writes each post about 2 days before its time, in your voice and from your business's facts.</DialogDescription>
        </DialogHeader>
        {createBlocked ? (
          <p className="flex items-start gap-2 rounded-lg border border-ai/20 bg-ai-surface px-3 py-2 text-sm text-foreground">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-ai" />
            {ai.state === "off" ? "Auto-posts need AI, which isn't switched on yet. You can start a series as soon as it is." : (ai.reason ?? "AI isn't available right now.")}
          </p>
        ) : null}
        {!series ? (
          <div className="rounded-lg border border-border bg-surface-strong px-3 py-2.5 text-sm">
            <p className="font-medium text-foreground">{seriesFormSummary(form)}</p>
            <p className="text-muted-foreground">These are the recommended settings. Turn it on as it is, or change anything below.</p>
          </div>
        ) : null}
        <form
          className="space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Field label="Name" htmlFor={`${ids}-name`} error={shown.name}>
            <Input
              id={`${ids}-name`}
              placeholder={SERIES_DEFAULT_NAME}
              maxLength={SERIES_FIELD_LIMITS.nameMax + 20}
              value={form.name}
              aria-invalid={Boolean(shown.name) || undefined}
              onChange={(event) => set("name", event.target.value)}
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">When</legend>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={cadenceKind} onValueChange={(value) => set("kind", value as SeriesCadence["kind"])}>
                <SelectTrigger className="w-44" aria-label="How often">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">On weekdays</SelectItem>
                  <SelectItem value="every_n_days">Every few days</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              {cadenceKind === "every_n_days" ? (
                <span className="flex items-center gap-2 text-sm">
                  every
                  <Input
                    type="number"
                    min={1}
                    max={SERIES_FIELD_LIMITS.everyNMax}
                    className="w-20"
                    aria-label="Number of days"
                    aria-invalid={Boolean(shown.everyN) || undefined}
                    value={form.everyN}
                    onChange={(event) => set("everyN", event.target.value)}
                  />
                  days
                </span>
              ) : cadenceKind === "monthly" ? (
                <span className="flex items-center gap-2 text-sm">
                  on day
                  <Input
                    type="number"
                    min={1}
                    max={SERIES_FIELD_LIMITS.dayOfMonthMax}
                    className="w-20"
                    aria-label="Day of the month"
                    aria-invalid={Boolean(shown.dayOfMonth) || undefined}
                    value={form.dayOfMonth}
                    onChange={(event) => set("dayOfMonth", event.target.value)}
                  />
                </span>
              ) : null}
              <span className="flex items-center gap-2 text-sm">
                at
                <Input
                  type="time"
                  className="w-32"
                  aria-label="Time of day"
                  aria-invalid={Boolean(shown.time) || undefined}
                  value={form.time}
                  onChange={(event) => set("time", event.target.value)}
                />
              </span>
            </div>
            {cadenceKind === "weekly" ? (
              <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Days of the week">
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
                      onClick={() => set("days", on ? form.days.filter((value) => value !== day.id) : [...form.days, day.id])}
                    >
                      {day.short}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            <FieldMessage message={shown.days ?? shown.everyN ?? shown.dayOfMonth ?? shown.time} />
            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
              <span className="text-muted-foreground">Time zone</span>
              {customZone ? (
                <Input
                  className="w-56"
                  aria-label="Time zone"
                  placeholder="e.g. America/Toronto"
                  aria-invalid={Boolean(shown.zone) || undefined}
                  value={form.zone}
                  onChange={(event) => set("zone", event.target.value)}
                />
              ) : (
                <Select value={form.zone} onValueChange={(value) => (value === OTHER_ZONE ? setCustomZone(true) : set("zone", value))}>
                  <SelectTrigger className="w-full sm:w-72" aria-label="Time zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {zoneOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                        {option === userZone ? " (yours)" : option === locationZone ? " (the location's)" : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_ZONE}>Another time zone…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <FieldMessage message={shown.zone} />
            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-starts`}>Starts</Label>
                <Input id={`${ids}-starts`} type="date" value={form.startsOn} onChange={(event) => set("startsOn", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-ends`}>Ends (optional)</Label>
                <Input
                  id={`${ids}-ends`}
                  type="date"
                  aria-invalid={Boolean(shown.dates) || undefined}
                  value={form.endsOn}
                  onChange={(event) => set("endsOn", event.target.value)}
                />
              </div>
            </div>
            <FieldMessage message={shown.dates} />
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Topics</legend>
            <RadioGroup value={form.topicMode} onValueChange={(value) => set("topicMode", value as SeriesTopicMode)} aria-label="Topics">
              <Choice id={`${ids}-topics-auto`} value="auto" title="Planned by AI (recommended)">
                A fresh topic for each post from your services, the questions customers ask, the season and your offers. Never repeated.
              </Choice>
              <Choice id={`${ids}-topics-list`} value="list" title="My own topics">
                Used in turn, one per post.
              </Choice>
            </RadioGroup>
            {form.topicMode === "list" ? (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor={`${ids}-topics`}>Topics, one per line</Label>
                <Textarea
                  id={`${ids}-topics`}
                  rows={4}
                  aria-invalid={Boolean(shown.topics) || undefined}
                  value={form.topics}
                  onChange={(event) => set("topics", event.target.value)}
                  placeholder={"Seasonal tips\nMeet the team\nWhy customers choose us"}
                />
              </div>
            ) : null}
            <FieldMessage message={shown.topics} />
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Keywords</legend>
            {tracking.isPending ? (
              <p className="text-sm text-muted-foreground">Loading your keywords…</p>
            ) : keywordChoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">This location tracks no keywords yet. AI writes from your business's facts.</p>
            ) : (
              <>
                <RadioGroup value={form.keywordMode} onValueChange={(value) => set("keywordMode", value as SeriesForm["keywordMode"])} aria-label="Keywords">
                  <Choice id={`${ids}-kw-all`} value="all" title="All your tracked keywords (recommended)">
                    AI picks the ones that fit each post, at most 2 a post.
                  </Choice>
                  <Choice id={`${ids}-kw-some`} value="some" title="Only some keywords">
                    Pick the keywords this series may use.
                  </Choice>
                </RadioGroup>
                {form.keywordMode === "some" ? (
                  <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Keywords this series may use">
                    {keywordChoices.map((keyword) => {
                      const on = form.keywords.some((value) => sameKeywords([value], [keyword]));
                      const gone = untracked.includes(keyword);
                      return (
                        <Button
                          key={keyword}
                          type="button"
                          size="sm"
                          variant={on ? "default" : "outline"}
                          aria-pressed={on}
                          onClick={() =>
                            set("keywords", on ? form.keywords.filter((value) => !sameKeywords([value], [keyword])) : [...form.keywords, keyword])
                          }
                        >
                          {keyword}
                          {gone ? " (no longer tracked)" : ""}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )}
            <FieldMessage message={shown.keywords} />
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Before it goes out</legend>
            {showAutoChoice ? (
              <RadioGroup value={form.publishMode} onValueChange={(value) => set("publishMode", value as SeriesPublishMode)} aria-label="Before it goes out">
                <Choice id={`${ids}-review`} value="review" title="Each post waits for review (recommended)">
                  It goes out only once someone who approves posts here says OK. A post nobody reviews in time goes back to drafts.
                </Choice>
                <Choice id={`${ids}-auto`} value="auto" title="Publishes on its own">
                  {switchText
                    ? `${switchText}, so each post still waits for review meanwhile.`
                    : `Each post goes out at its time unless a safety check holds it for a person. The first 3 posts still wait for review${agency ? ", and your client approves automatic posts once" : ""}.`}
                </Choice>
              </RadioGroup>
            ) : (
              <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-strong px-3 py-2.5 text-sm text-foreground">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  Each post waits for review: it goes out only once someone who approves posts here says OK. A post nobody reviews in time goes back to drafts.{" "}
                  <span className="text-muted-foreground">Automatic publishing isn't switched on yet.</span>
                </span>
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">Style</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-tone`}>Tone</Label>
                <Select value={form.tone} onValueChange={(value) => set("tone", value as PostTone)}>
                  <SelectTrigger id={`${ids}-tone`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TONE_LABEL) as PostTone[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {TONE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-cta`}>Button</Label>
                <Select value={form.cta} onValueChange={(value) => set("cta", value as SeriesButton)}>
                  <SelectTrigger id={`${ids}-cta`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Chosen for each post</SelectItem>
                    {(Object.keys(CTA_LABEL) as CtaType[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {CTA_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.cta === "auto" ? (
              <p className="text-xs text-muted-foreground">Your default button for posts, else "Learn more" to the page about the post's service, else "Call now".</p>
            ) : form.cta !== "CALL" ? (
              <Field label="Button link (https)" htmlFor={`${ids}-cta-url`} error={shown.ctaUrl}>
                <Input
                  id={`${ids}-cta-url`}
                  type="url"
                  aria-invalid={Boolean(shown.ctaUrl) || undefined}
                  value={form.ctaUrl}
                  onChange={(event) => set("ctaUrl", event.target.value)}
                />
              </Field>
            ) : null}
            <label className="flex min-h-9 cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox checked={form.includeImage} onCheckedChange={(value) => set("includeImage", value === true)} className="mt-0.5" />
              <span>
                Add a picture to each post
                <span className="block text-xs text-muted-foreground">A photo from your library when one fits, else an AI image.</span>
              </span>
            </label>
            {form.includeImage && !photosPublishable ? (
              <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2 text-xs text-warning-foreground">
                <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
                Posts with a photo can't be published to Google yet, so these posts would fail. Leave pictures off for now.
              </p>
            ) : null}
            <Field label="House rules (optional)" htmlFor={`${ids}-rules`} error={shown.instructions}>
              <Textarea
                id={`${ids}-rules`}
                rows={2}
                maxLength={SERIES_FIELD_LIMITS.instructionsMax}
                placeholder="e.g. Never mention prices."
                value={form.instructions}
                onChange={(event) => set("instructions", event.target.value)}
              />
            </Field>
          </fieldset>

          <p className="flex items-start gap-2 rounded-lg border border-ai/20 bg-ai-surface px-3 py-2.5 text-sm text-foreground">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-ai" />
            <span>
              Each post spends up to <AiCostChip tokens={perPost} balance={ai.balance} className="mx-0.5 align-middle" /> automatically ({formatTokens(ai.costs.post_draft)} for the text
              {form.includeImage ? `, plus ${formatTokens(imageCost)} when the picture is an AI image` : ""}).
              {series ? "" : " Turning this on is your consent to that spend."}
            </span>
          </p>
          {pausedPlanner ? (
            <p className="flex items-start gap-2 rounded-lg border border-info/25 bg-info-surface px-3 py-2.5 text-sm text-foreground">
              <CirclePause aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
              <span>{plannerPausedReason(pausedPlanner)} Until they start, the series is saved but writes and spends nothing on its own.</span>
            </p>
          ) : null}
          {releasing ? (
            <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2.5 text-sm text-warning-foreground">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                Saving sends the posts this series already wrote for upcoming dates back to drafts, and AI writes them again with the new settings.
                {form.publishMode === "auto" ? " Its first 3 posts wait for review again." : ""}
              </span>
            </p>
          ) : null}
          {tried && Object.keys(problems).length > 0 ? (
            <p role="alert" className="text-sm font-medium text-critical">
              Fix the highlighted fields before saving.
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="ai" disabled={saving || createBlocked} aria-busy={saving || undefined} title={createBlocked ? ai.reason : undefined}>
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} {series ? "Save changes" : "Turn on auto-posts"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string | undefined; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      <FieldMessage message={error} />
    </div>
  );
}

function FieldMessage({ message }: { message?: string | undefined }) {
  return message ? (
    <p className="flex items-start gap-1.5 text-xs font-medium text-critical">
      <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
      {message}
    </p>
  ) : null;
}

/** A radio choice with a title and a plain explanation; the whole card is the target. */
function Choice({ id, value, title, children }: { id: string; value: string; title: string; children: ReactNode }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/40",
        "has-[[data-state=checked]]:border-primary/60 has-[[data-state=checked]]:bg-brand-tint",
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="min-w-0">
        <span className="font-medium text-foreground">{title}</span>
        <span className="block text-muted-foreground">{children}</span>
      </span>
    </label>
  );
}
