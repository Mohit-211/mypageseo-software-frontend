import { useState } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Eye, LoaderCircle, Pencil, Plus, Repeat, Sparkles, Trash2 } from "lucide-react";
import {
  createPostSeries,
  deletePostSeries,
  generateNextSeriesPost,
  getPostSeriesPreview,
  setPostSeriesActive,
  updatePostSeries,
  type Post,
  type PostCtaType,
  type PostSeries,
  type PostSeriesCadence,
  type PostSeriesInput,
  type PostsSummary,
  type PostTone,
} from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/lib/datetime";
import {
  POST_CTA_LABEL,
  POST_TONE_LABEL,
  SERIES_FAILURE_COPY,
  WEEKDAY_NAMES,
  cadenceText,
  needsTokens,
  postErrorMessage,
} from "@/lib/posts/posts";
import { postsKey, usePostAiCosts, usePostSeries } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";

const INSTRUCTIONS_MAX = 500;

/**
 * Auto-posts: the server writes each post about 48 h before its time (text, plus an image
 * when on), and it publishes on time unless someone changes it. At most 3 active series.
 */
export function PostSeriesPanel({
  locationId,
  summary,
  onOpenPost,
}: {
  locationId: string;
  summary: PostsSummary;
  onOpenPost: (post: Post) => void;
}) {
  const series = usePostSeries(locationId);
  const [editing, setEditing] = useState<{ series: PostSeries | null } | null>(null);

  if (series.isPending) return <ListSkeleton rows={2} />;
  if (series.isError) {
    return <ErrorState description={postErrorMessage(series.error, "Auto-posts couldn't be loaded.")} onRetry={() => void series.refetch()} />;
  }

  const active = series.data.series.filter((item) => item.active).length;
  const full = active >= series.data.limit;
  const canCreate = summary.connection.gbp_connected && !full;

  return (
    <div className="space-y-4">
      <Panel
        title="Auto-posts"
        description={`AI writes each post about two days before its time, and it publishes on time unless you change it. ${active} of ${series.data.limit} active.`}
        actions={
          <Button size="sm" disabled={!canCreate} onClick={() => setEditing({ series: null })}>
            <Plus aria-hidden /> New series
          </Button>
        }
      >
        {!summary.connection.gbp_connected ? (
          <p className="text-sm text-muted-foreground">Connect this location's Business Profile to set up auto-posts.</p>
        ) : series.data.series.length === 0 ? (
          <EmptyState
            compact
            icon={Repeat}
            title="No auto-posts yet"
            description="Pick days, a time and a few topics once; new posts are written and scheduled for you."
            action={<Button size="sm" onClick={() => setEditing({ series: null })}><Plus aria-hidden /> New series</Button>}
          />
        ) : (
          <ul className="space-y-3">
            {series.data.series.map((item) => (
              <SeriesCard
                key={item.series_id}
                locationId={locationId}
                series={item}
                canResume={!full}
                onEdit={() => setEditing({ series: item })}
                onOpenPost={onOpenPost}
              />
            ))}
          </ul>
        )}
        {full ? <p className="mt-3 text-xs text-muted-foreground">Pause or delete a series to add another.</p> : null}
      </Panel>

      {editing ? <SeriesForm locationId={locationId} series={editing.series} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function SeriesCard({
  locationId,
  series,
  canResume,
  onEdit,
  onOpenPost,
}: {
  locationId: string;
  series: PostSeries;
  canResume: boolean;
  onEdit: () => void;
  onOpenPost: (post: Post) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const costs = usePostAiCosts();
  const [busy, setBusy] = useState<"toggle" | "generate" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const perPost = costs.draft + (series.include_image ? costs.image : 0);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });

  const toggle = async (next: boolean) => {
    setBusy("toggle");
    try {
      await setPostSeriesActive(locationId, series.series_id, next);
      toast.success(next ? "Series resumed" : "Series paused");
      refresh();
    } catch (err) {
      toast.error(postErrorMessage(err, "The series couldn't be changed."));
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setBusy("generate");
    try {
      const result = await generateNextSeriesPost(locationId, series.series_id);
      toast.success("Next post written", { description: "Check it before it goes out." });
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      onOpenPost(result.post);
    } catch (err) {
      toast.error(
        postErrorMessage(err, "The post couldn't be written."),
        needsTokens(err) ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {series.name}
            <StatusBadge tone={series.active ? "success" : "neutral"}>{series.active ? "Active" : "Paused"}</StatusBadge>
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {cadenceText(series.cadence)} at {series.time_of_day} ({series.time_zone.replace(/_/g, " ")}) · from {formatDate(`${series.starts_on}T00:00:00`)}
            {series.ends_on ? ` to ${formatDate(`${series.ends_on}T00:00:00`)}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {POST_TONE_LABEL[series.tone]} · {series.include_image ? "With images" : "Text only"}
            {series.cta ? ` · Button: ${POST_CTA_LABEL[series.cta.type]}` : ""} · {series.posts_generated} written so far · about {perPost} token{perPost === 1 ? "" : "s"} a post
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Topics: {series.topics.join(" · ")}</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Switch
            checked={series.active}
            disabled={busy !== null || (!series.active && !canResume)}
            onCheckedChange={(value) => void toggle(value)}
            aria-label={series.active ? "Pause series" : "Resume series"}
          />
          {series.active ? "On" : "Off"}
        </label>
      </div>

      {series.last_error ? (
        <p className="mt-3 flex gap-2 rounded-md border border-warning/35 bg-warning-surface/40 p-2.5 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {SERIES_FAILURE_COPY[series.last_error.code] ?? series.last_error.message}
            {series.last_error.slot_at ? `: the post for ${formatDateTime(series.last_error.slot_at)} hasn't been written yet. We retry every hour until its time.` : "."}
          </span>
        </p>
      ) : null}

      {series.active && series.next_slots.length > 0 ? (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden /> Next:
          {series.next_slots.slice(0, 3).map((slot) => (
            <span key={slot} className="rounded bg-muted px-1.5 py-0.5 text-foreground">{formatDateTime(slot)}</span>
          ))}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}><Pencil aria-hidden /> Edit</Button>
        <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}><Eye aria-hidden /> What's coming</Button>
        <Button size="sm" variant="outline" disabled={busy !== null || !series.active} onClick={() => void generate()}>
          {busy === "generate" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} Write next post now · {perPost} token{perPost === 1 ? "" : "s"}
        </Button>
        {series.history.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setHistoryOpen((value) => !value)}>{historyOpen ? "Hide history" : "History"}</Button>
        ) : null}
        <Button size="sm" variant="ghost" className="text-critical hover:text-critical" onClick={() => setDeleteOpen(true)}><Trash2 aria-hidden /> Delete</Button>
      </div>
      {busy === "generate" ? <p className="mt-2 text-xs text-muted-foreground">Writing the post{series.include_image ? " and its image" : ""}. This can take up to a minute.</p> : null}

      {historyOpen ? (
        <ul className="mt-3 divide-y divide-border border-t border-border text-xs">
          {series.history.map((entry, index) => (
            <li key={`${entry.slot_at}-${index}`} className="flex flex-wrap gap-x-2 py-1.5">
              <span className="text-muted-foreground">{formatDateTime(entry.slot_at)}</span>
              <span className={entry.outcome === "failed" ? "text-critical" : "text-foreground"}>
                {entry.outcome === "generated" ? (entry.reason === "image_failed" ? SERIES_FAILURE_COPY.image_failed : "Written") : `Skipped: ${SERIES_FAILURE_COPY[entry.reason ?? ""] ?? entry.reason ?? "failed"}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {previewOpen ? <PreviewDialog locationId={locationId} series={series} onClose={() => setPreviewOpen(false)} /> : null}
      {deleteOpen ? <DeleteSeriesDialog locationId={locationId} series={series} onClose={() => setDeleteOpen(false)} /> : null}
    </li>
  );
}

function PreviewDialog({ locationId, series, onClose }: { locationId: string; series: PostSeries; onClose: () => void }) {
  const preview = useQuery({
    queryKey: [...postsKey(locationId), "series", series.series_id, "preview"],
    queryFn: ({ signal }) => getPostSeriesPreview(locationId, series.series_id, 5, signal),
  });
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What's coming</DialogTitle>
          <DialogDescription>The next posts of "{series.name}" and when each is written.</DialogDescription>
        </DialogHeader>
        {preview.isPending ? (
          <ListSkeleton rows={3} />
        ) : preview.isError ? (
          <ErrorState description={postErrorMessage(preview.error, "The preview couldn't be loaded.")} onRetry={() => void preview.refetch()} />
        ) : preview.data.slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No more posts are planned.</p>
        ) : (
          <ul className="divide-y divide-border">
            {preview.data.slots.map((slot) => (
              <li key={slot.slot_at} className="py-2.5">
                <p className="text-sm font-medium text-foreground">{formatDateTime(slot.slot_at)}</p>
                <p className="text-sm text-foreground">{slot.topic}</p>
                <p className="text-xs text-muted-foreground">Written around {formatDateTime(slot.generates_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteSeriesDialog({ locationId, series, onClose }: { locationId: string; series: PostSeries; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [cancelScheduled, setCancelScheduled] = useState(true);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await deletePostSeries(locationId, series.series_id, !cancelScheduled);
      toast.success("Series deleted", cancelScheduled ? { description: "Its scheduled posts moved to Drafts." } : undefined);
      void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
      onClose();
    } catch (err) {
      toast.error(postErrorMessage(err, "The series couldn't be deleted."));
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete "{series.name}"?</DialogTitle>
          <DialogDescription>No more posts are written for it. Published posts stay on Google.</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <Checkbox checked={cancelScheduled} onCheckedChange={(value) => setCancelScheduled(value === true)} className="mt-0.5" />
          <span>
            Also cancel its scheduled posts
            <span className="block text-xs text-muted-foreground">They move to Drafts. Untick to let them publish as planned.</span>
          </span>
        </label>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button className="bg-critical text-white hover:bg-critical/90" disabled={busy} onClick={() => void remove()}>
            {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Delete series
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SeriesFormState = {
  name: string;
  kind: PostSeriesCadence["kind"];
  days: string[];
  n: string;
  dayOfMonth: string;
  time: string;
  startsOn: string;
  endsOn: string;
  topics: string;
  tone: PostTone;
  ctaType: PostCtaType | "none";
  ctaUrl: string;
  includeImage: boolean;
  instructions: string;
};

function toFormState(series: PostSeries | null): SeriesFormState {
  const cadence = series?.cadence;
  return {
    name: series?.name ?? "",
    kind: cadence?.kind ?? "weekly",
    days: cadence?.kind === "weekly" ? cadence.days_of_week : ["MONDAY", "THURSDAY"],
    n: cadence?.kind === "every_n_days" ? String(cadence.n) : "3",
    dayOfMonth: cadence?.kind === "monthly" ? String(cadence.day_of_month) : "1",
    time: series?.time_of_day ?? "09:00",
    startsOn: series?.starts_on ?? format(new Date(), "yyyy-MM-dd"),
    endsOn: series?.ends_on ?? "",
    topics: series?.topics.join("\n") ?? "",
    tone: series?.tone ?? "friendly",
    ctaType: series?.cta?.type ?? "none",
    ctaUrl: series?.cta?.url ?? "",
    includeImage: series?.include_image ?? true,
    instructions: series?.instructions ?? "",
  };
}

function toSeriesInput(form: SeriesFormState): PostSeriesInput {
  const cadence: PostSeriesCadence =
    form.kind === "weekly"
      ? { kind: "weekly", days_of_week: form.days }
      : form.kind === "every_n_days"
        ? { kind: "every_n_days", n: Number(form.n) }
        : { kind: "monthly", day_of_month: Number(form.dayOfMonth) };
  return {
    name: form.name.trim(),
    cadence,
    time_of_day: form.time,
    starts_on: form.startsOn,
    ends_on: form.endsOn || null,
    topics: form.topics.split("\n").map((topic) => topic.trim()).filter(Boolean),
    tone: form.tone,
    cta: form.ctaType === "none" ? null : { type: form.ctaType, url: form.ctaType === "CALL" ? null : form.ctaUrl.trim() || null },
    include_image: form.includeImage,
    instructions: form.instructions.trim() || null,
  };
}

function SeriesForm({ locationId, series, onClose }: { locationId: string; series: PostSeries | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const costs = usePostAiCosts();
  const [form, setForm] = useState<SeriesFormState>(() => toFormState(series));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof SeriesFormState>(key: K, value: SeriesFormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const perPost = costs.draft + (form.includeImage ? costs.image : 0);

  const input = toSeriesInput(form);
  const missing =
    !input.name
      ? "Give the series a name."
      : input.topics.length === 0
        ? "Add at least one topic."
        : form.kind === "weekly" && form.days.length === 0
          ? "Pick at least one day."
          : form.ctaType !== "none" && form.ctaType !== "CALL" && !/^https:\/\//.test(form.ctaUrl.trim())
            ? "The button link must start with https://."
            : null;

  const save = async () => {
    if (missing) {
      setError(missing);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (series) await updatePostSeries(locationId, series.series_id, input);
      else await createPostSeries(locationId, input);
      toast.success(series ? "Series updated" : "Auto-posts set up", series ? { description: "Changes apply to posts not written yet." } : undefined);
      void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
      onClose();
    } catch (err) {
      setError(postErrorMessage(err, "The series couldn't be saved."));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{series ? "Edit auto-posts" : "New auto-post series"}</DialogTitle>
          <DialogDescription>{series ? "Changes apply to posts that aren't written yet." : "Set it up once; each post is written about two days before its time."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormRow label="Name">
            <Input value={form.name} placeholder="Weekly tips" disabled={busy} onChange={(event) => set("name", event.target.value)} />
          </FormRow>

          <FormRow label="How often">
            <Select value={form.kind} disabled={busy} onValueChange={(value) => set("kind", value as SeriesFormState["kind"])}>
              <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">On chosen weekdays</SelectItem>
                <SelectItem value="every_n_days">Every few days</SelectItem>
                <SelectItem value="monthly">Once a month</SelectItem>
              </SelectContent>
            </Select>
            {form.kind === "weekly" ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {WEEKDAY_NAMES.map((day) => {
                  const active = form.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      disabled={busy}
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
            ) : form.kind === "every_n_days" ? (
              <div className="flex items-center gap-2 pt-1 text-sm">
                Every <Input type="number" min={1} max={30} className="w-20" value={form.n} disabled={busy} aria-label="Days between posts" onChange={(event) => set("n", event.target.value)} /> days
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1 text-sm">
                On day <Input type="number" min={1} max={28} className="w-20" value={form.dayOfMonth} disabled={busy} aria-label="Day of the month" onChange={(event) => set("dayOfMonth", event.target.value)} />
              </div>
            )}
          </FormRow>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormRow label="Time">
              <Input type="time" value={form.time} disabled={busy} onChange={(event) => set("time", event.target.value)} />
            </FormRow>
            <FormRow label="Starts">
              <Input type="date" value={form.startsOn} disabled={busy} onChange={(event) => set("startsOn", event.target.value)} />
            </FormRow>
            <FormRow label="Ends (optional)">
              <Input type="date" value={form.endsOn} disabled={busy} onChange={(event) => set("endsOn", event.target.value)} />
            </FormRow>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">The time is the business's local time.</p>

          <FormRow label="Topics (one per line, used in turn)">
            <Textarea rows={4} value={form.topics} placeholder={"Seasonal maintenance tips\nMeet the team\nWhy customers choose us"} disabled={busy} onChange={(event) => set("topics", event.target.value)} />
          </FormRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Tone">
              <Select value={form.tone} disabled={busy} onValueChange={(value) => set("tone", value as PostTone)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(POST_TONE_LABEL) as PostTone[]).map((value) => <SelectItem key={value} value={value}>{POST_TONE_LABEL[value]}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Button">
              <Select value={form.ctaType} disabled={busy} onValueChange={(value) => set("ctaType", value as SeriesFormState["ctaType"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Let the AI choose</SelectItem>
                  {(Object.keys(POST_CTA_LABEL) as PostCtaType[]).map((cta) => <SelectItem key={cta} value={cta}>{POST_CTA_LABEL[cta]}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormRow>
            {form.ctaType !== "none" && form.ctaType !== "CALL" ? (
              <FormRow label="Button link" className="sm:col-span-2">
                <Input type="url" placeholder="https://" value={form.ctaUrl} disabled={busy} onChange={(event) => set("ctaUrl", event.target.value)} />
              </FormRow>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Switch checked={form.includeImage} disabled={busy} onCheckedChange={(value) => set("includeImage", value)} />
            Add an AI image to each post
          </label>

          <FormRow label="Instructions for the AI (optional)">
            <Textarea rows={2} maxLength={INSTRUCTIONS_MAX} value={form.instructions} placeholder="Never mention prices." disabled={busy} onChange={(event) => set("instructions", event.target.value)} />
            <p className="text-xs text-muted-foreground">{form.instructions.length} / {INSTRUCTIONS_MAX}</p>
          </FormRow>

          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
            Each post costs <strong>{perPost} token{perPost === 1 ? "" : "s"}</strong> ({costs.draft} for the text{form.includeImage ? `, ${costs.image} for the image` : ""}), taken when it's written.
            Posts <strong>publish automatically</strong> at their time unless you edit, unschedule or delete them. {series ? "" : "Creating the series agrees to this."}
          </p>

          {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
            {series ? "Save changes" : "Start auto-posts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormRow({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  );
}
