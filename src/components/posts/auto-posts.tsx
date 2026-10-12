import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, LoaderCircle, Pause, Pencil, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  createPostSeries,
  deletePostSeries,
  generateNextSeriesPost,
  previewPostSeries,
  setPostSeriesActive,
  updatePostSeries,
  type CtaType,
  type Post,
  type PostSeries,
  type PostSeriesInput,
  type PostTone,
  type SeriesCadence,
  type Weekday,
} from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCanEdit } from "@/hooks/use-access";
import { formatDateTime } from "@/lib/datetime";
import {
  CTA_LABEL,
  TONE_LABEL,
  WEEKDAYS,
  postErrorText,
  postsKey,
  seriesErrorText,
  tokens,
  useAiAvailable,
  useAiCosts,
  useInvalidatePosts,
  usePostSeries,
} from "@/lib/posts/use-posts";

function cadenceText(cadence: SeriesCadence): string {
  if (cadence.kind === "weekly") {
    const days = WEEKDAYS.filter((day) => cadence.days_of_week.includes(day.id)).map((day) => day.short);
    return `Every ${days.join(", ") || "week"}`;
  }
  if (cadence.kind === "every_n_days") return cadence.n === 1 ? "Every day" : `Every ${cadence.n} days`;
  return `Monthly on day ${cadence.day_of_month}`;
}

/**
 * Auto-posts (AI series): the server writes each post about 48 h ahead and publishes it
 * on time unless someone changes it. Creating a series is consent to its token spend.
 */
export function AutoPosts({
  locationId,
  timeZone,
  gbpConnected,
  onOpenPost,
}: {
  locationId: string;
  /** The location's IANA time zone (series times are in it); null when unknown (the server then uses UTC). */
  timeZone: string | null;
  gbpConnected: boolean;
  onOpenPost: (post: Post) => void;
}) {
  const canEdit = useCanEdit();
  const aiAvailable = useAiAvailable();
  const list = usePostSeries(locationId);
  const [editing, setEditing] = useState<PostSeries | "new" | null>(null);

  if (list.isPending) return <ListSkeleton rows={2} />;
  if (list.isError) return <ErrorState description={postErrorText(list.error, "Auto-posts couldn't be loaded.").message} onRetry={() => void list.refetch()} />;
  const { series, limit } = list.data;
  const active = series.filter((entry) => entry.active).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          AI writes each post about 2 days before its time. It publishes automatically unless you edit, unschedule or delete it. Up to {limit} active series.
        </p>
        {canEdit && aiAvailable ? (
          <Button size="sm" disabled={!gbpConnected || active >= limit} title={!gbpConnected ? "Connect the location to Google first" : undefined} onClick={() => setEditing("new")}>
            <Plus aria-hidden /> New auto-post series
          </Button>
        ) : null}
      </div>
      {!aiAvailable ? (
        <p className="rounded-md border border-warning/40 bg-warning-surface/40 px-3 py-2 text-sm text-warning-foreground">
          AI isn't available yet, so auto-posts can't be set up. Existing series keep their schedule but can't write new posts until it is.
        </p>
      ) : null}
      {series.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No auto-posts yet"
          description={gbpConnected ? "Pick days, a time and a few topics, and MyPageSEO keeps the profile active for you." : "Connect this location to Google to set up auto-posts."}
        />
      ) : (
        series.map((entry) => <SeriesCard key={entry.series_id} locationId={locationId} series={entry} onEdit={() => setEditing(entry)} onOpenPost={onOpenPost} />)
      )}
      {editing ? <SeriesDialog locationId={locationId} timeZone={timeZone} series={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function SeriesCard({ locationId, series, onEdit, onOpenPost }: { locationId: string; series: PostSeries; onEdit: () => void; onOpenPost: (post: Post) => void }) {
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const costs = useAiCosts();
  const aiAvailable = useAiAvailable();
  const invalidate = useInvalidatePosts(locationId);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const preview = useQuery({
    queryKey: [...postsKey(locationId), "series", series.series_id, "preview"],
    queryFn: ({ signal }) => previewPostSeries(locationId, series.series_id, 5, signal),
    enabled: showPreview,
  });
  const perPost = costs.draft + (series.include_image ? costs.image : 0);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      const result = await action();
      toast.success(success);
      if (key === "generate" && result && typeof result === "object" && "post" in result) onOpenPost((result as { post: Post }).post);
    } catch (err) {
      const { message, buyTokens } = postErrorText(err, "That didn't work. Try again.");
      toast.error(message, buyTokens ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined);
    } finally {
      setBusy(null);
      invalidate();
    }
  };

  return (
    <Panel
      title={series.name}
      description={`${cadenceText(series.cadence)} at ${series.time_of_day} ${series.time_zone}${series.time_zone_source === "default" ? " (no time zone set)" : ""} · ${TONE_LABEL[series.tone]} · ${series.include_image ? "with image" : "text only"} · ${tokens(perPost)} per post`}
      actions={<StatusBadge tone={series.active ? "success" : "neutral"}>{series.active ? "Active" : "Paused"}</StatusBadge>}
    >
      <div className="space-y-3 text-sm">
        {series.last_error ? (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-surface/40 px-3 py-2 text-warning-foreground">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {seriesErrorText(series.last_error.code)}: the post for {formatDateTime(series.last_error.slot_at)} wasn't made. It's retried every hour until its time passes.
          </p>
        ) : null}
        <p className="text-muted-foreground">
          {series.posts_generated} post{series.posts_generated === 1 ? "" : "s"} written so far.
          {series.active && series.next_slots.length > 0 ? ` Next: ${series.next_slots.slice(0, 3).map((slot) => formatDateTime(slot)).join(", ")}.` : ""}
        </p>
        <p className="text-xs text-muted-foreground">Topics, in turn: {series.topics.join(" · ")}</p>
        {series.history.length > 0 ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Recent outcomes</summary>
            <ul className="mt-1 space-y-0.5">
              {series.history.slice(0, 8).map((entry) => (
                <li key={`${entry.slot_at}-${entry.at}`} className={entry.outcome === "failed" ? "text-critical" : "text-muted-foreground"}>
                  {formatDateTime(entry.slot_at)}:{" "}
                  {entry.outcome === "generated" ? (entry.reason === "image_failed" ? "written (text only: the image failed)" : "written") : `skipped (${seriesErrorText(entry.reason ?? "")})`}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <div>
          <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setShowPreview((value) => !value)}>
            <CalendarClock aria-hidden /> {showPreview ? "Hide" : "What's coming"}
          </Button>
          {showPreview ? (
            preview.isPending ? (
              <LoaderCircle aria-label="Loading" className="size-4 animate-spin text-muted-foreground" />
            ) : preview.data ? (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {preview.data.slots.map((slot) => (
                  <li key={slot.slot_at}>{formatDateTime(slot.slot_at)}: “{slot.topic}” (written {formatDateTime(slot.generates_at)})</li>
                ))}
              </ul>
            ) : null
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={onEdit}><Pencil aria-hidden /> Edit</Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void run("toggle", () => setPostSeriesActive(locationId, series.series_id, !series.active), series.active ? "Paused." : "Resumed.")}
            >
              {series.active ? <Pause aria-hidden /> : <Play aria-hidden />} {series.active ? "Pause" : "Resume"}
            </Button>
            {series.active && aiAvailable ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void run("generate", () => generateNextSeriesPost(locationId, series.series_id), "The next post is written.")}
              >
                {busy === "generate" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} Write the next post now ({tokens(perPost)})
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" className="text-critical" disabled={busy !== null} onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden /> Delete
            </Button>
          </div>
        ) : null}
      </div>
      {deleting ? (
        <DeleteSeriesDialog
          name={series.name}
          onClose={() => setDeleting(false)}
          onDelete={(keepScheduled) => {
            setDeleting(false);
            void run("delete", () => deletePostSeries(locationId, series.series_id, keepScheduled), "Series deleted.");
          }}
        />
      ) : null}
    </Panel>
  );
}

function DeleteSeriesDialog({ name, onClose, onDelete }: { name: string; onClose: () => void; onDelete: (keepScheduled: boolean) => void }) {
  const [cancelScheduled, setCancelScheduled] = useState(true);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{name}”?</DialogTitle>
          <DialogDescription>No new posts are written. Published posts stay on Google.</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={cancelScheduled} onCheckedChange={(value) => setCancelScheduled(value === true)} className="mt-0.5" />
          Also cancel its scheduled posts (they move to Drafts)
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => onDelete(!cancelScheduled)}>Delete series</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function SeriesDialog({ locationId, timeZone, series, onClose }: { locationId: string; timeZone: string | null; series: PostSeries | null; onClose: () => void }) {
  const navigate = useNavigate();
  const costs = useAiCosts();
  const invalidate = useInvalidatePosts(locationId);
  const [name, setName] = useState(series?.name ?? "");
  const [kind, setKind] = useState<SeriesCadence["kind"]>(series?.cadence.kind ?? "weekly");
  const [days, setDays] = useState<Weekday[]>(series?.cadence.kind === "weekly" ? series.cadence.days_of_week : ["MONDAY", "THURSDAY"]);
  const [everyN, setEveryN] = useState(series?.cadence.kind === "every_n_days" ? String(series.cadence.n) : "3");
  const [dayOfMonth, setDayOfMonth] = useState(series?.cadence.kind === "monthly" ? String(series.cadence.day_of_month) : "1");
  const [time, setTime] = useState(series?.time_of_day ?? "09:00");
  // Mohit (2026-10-12): series times are in the user's own zone unless they pick another.
  const userZone = browserTimeZone();
  const [zone, setZone] = useState(series ? series.time_zone : userZone);
  const zoneOptions = Array.from(new Set([userZone, ...(timeZone ? [timeZone] : []), ...(series ? [series.time_zone] : [])]));
  const [customZone, setCustomZone] = useState(false);
  const [startsOn, setStartsOn] = useState(series?.starts_on ?? today());
  const [endsOn, setEndsOn] = useState(series?.ends_on ?? "");
  const [topics, setTopics] = useState((series?.topics ?? []).join("\n"));
  const [tone, setTone] = useState<PostTone>(series?.tone ?? "friendly");
  const [cta, setCta] = useState<CtaType | "none">(series?.cta?.type ?? "CALL");
  const [ctaUrl, setCtaUrl] = useState(series?.cta?.url ?? "");
  const [includeImage, setIncludeImage] = useState(series?.include_image ?? true);
  const [instructions, setInstructions] = useState(series?.instructions ?? "");
  const [saving, setSaving] = useState(false);
  const perPost = costs.draft + (includeImage ? costs.image : 0);
  const topicList = topics.split("\n").map((topic) => topic.trim()).filter(Boolean);

  const cadence: SeriesCadence =
    kind === "weekly" ? { kind, days_of_week: days } : kind === "every_n_days" ? { kind, n: Number(everyN) } : { kind, day_of_month: Number(dayOfMonth) };

  const save = async () => {
    setSaving(true);
    const input: PostSeriesInput = {
      name: name.trim(),
      cadence,
      time_of_day: time,
      starts_on: startsOn,
      ends_on: endsOn || null,
      topics: topicList,
      tone,
      cta: cta === "none" ? null : { type: cta, url: cta === "CALL" ? null : ctaUrl.trim() || null },
      include_image: includeImage,
      instructions: instructions.trim() || null,
      // Sent on create, and on edit only when it changed.
      ...(!series || zone !== series.time_zone ? { time_zone: zone.trim() } : {}),
    };
    try {
      if (series) await updatePostSeries(locationId, series.series_id, input);
      else await createPostSeries(locationId, input);
      invalidate();
      toast.success(series ? "Series updated. Changes apply to posts not written yet." : "Auto-posts are on.");
      onClose();
    } catch (err) {
      const { message, buyTokens } = postErrorText(err, "The series couldn't be saved.");
      toast.error(message, buyTokens ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined);
    } finally {
      setSaving(false);
    }
  };

  const valid = name.trim() && topicList.length > 0 && time && zone.trim() && startsOn && (kind !== "weekly" || days.length > 0);

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{series ? "Edit auto-posts" : "New auto-post series"}</DialogTitle>
          <DialogDescription>AI writes each post about 2 days ahead and publishes it on time unless you change it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="series-name">Name</Label>
            <Input id="series-name" placeholder="Weekly tips" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>How often</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={kind} onValueChange={(value) => setKind(value as SeriesCadence["kind"])}>
                <SelectTrigger className="w-44 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">On weekdays</SelectItem>
                  <SelectItem value="every_n_days">Every few days</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              {kind === "every_n_days" ? (
                <span className="flex items-center gap-2 text-sm">every <Input type="number" min={1} max={30} className="w-20" value={everyN} onChange={(event) => setEveryN(event.target.value)} /> days</span>
              ) : kind === "monthly" ? (
                <span className="flex items-center gap-2 text-sm">on day <Input type="number" min={1} max={28} className="w-20" value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} /></span>
              ) : null}
              <span className="flex items-center gap-2 text-sm">at <Input type="time" className="w-32" value={time} onChange={(event) => setTime(event.target.value)} /></span>
            </div>
            {kind === "weekly" ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {WEEKDAYS.map((day) => {
                  const on = days.includes(day.id);
                  return (
                    <Button key={day.id} type="button" size="sm" variant={on ? "default" : "outline"} className="h-7 px-2.5 text-xs" onClick={() => setDays(on ? days.filter((d) => d !== day.id) : [...days, day.id])}>
                      {day.short}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
              <span className="text-muted-foreground">Time zone</span>
              {customZone ? (
                <Input className="w-56" placeholder="e.g. America/Toronto" value={zone} onChange={(event) => setZone(event.target.value)} />
              ) : (
                <Select value={zone} onValueChange={(value) => (value === "__other__" ? setCustomZone(true) : setZone(value))}>
                  <SelectTrigger className="w-64 bg-background" aria-label="Time zone"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {zoneOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                        {option === userZone ? " (yours)" : option === timeZone ? " (the location's)" : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="__other__">Another time zone…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Starts</Label><Input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Ends (optional)</Label><Input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="series-topics">Topics, one per line (used in turn)</Label>
            <Textarea id="series-topics" rows={4} value={topics} onChange={(event) => setTopics(event.target.value)} placeholder={"Seasonal tips\nMeet the team\nWhy customers choose us"} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(value) => setTone(value as PostTone)}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(TONE_LABEL) as PostTone[]).map((value) => <SelectItem key={value} value={value}>{TONE_LABEL[value]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Button</Label>
              <Select value={cta} onValueChange={(value) => setCta(value as CtaType | "none")}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Let the AI choose</SelectItem>
                  {(Object.keys(CTA_LABEL) as CtaType[]).map((value) => <SelectItem key={value} value={value}>{CTA_LABEL[value]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {cta !== "none" && cta !== "CALL" ? (
            <div className="space-y-1.5"><Label>Button link (https)</Label><Input type="url" value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} /></div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeImage} onCheckedChange={(value) => setIncludeImage(value === true)} /> Add an AI image to each post
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="series-rules">House rules (optional)</Label>
            <Textarea id="series-rules" rows={2} maxLength={500} placeholder="e.g. Never mention prices." value={instructions} onChange={(event) => setInstructions(event.target.value)} />
          </div>
          <p className="rounded-md border border-warning/40 bg-warning-surface/40 px-3 py-2 text-sm text-warning-foreground">
            Each post spends {tokens(perPost)} automatically ({tokens(costs.draft)} for the text{includeImage ? ` + ${tokens(costs.image)} for the image` : ""}), and publishes on its own unless you change it.
            {series ? "" : " Turning this on is your consent to that spend."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={saving || !valid} onClick={() => void save()}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} {series ? "Save" : "Turn on auto-posts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
