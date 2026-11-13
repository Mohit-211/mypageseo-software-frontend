import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  Lightbulb,
  MessageSquareHeart,
  PenLine,
  Sparkles,
  Star,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { CheckState, GbpCheck, GbpPillarId, GbpReport, GbpScore, ScoreHistoryEntry } from "@/api";
import { Panel, StatusBadge, TrendIndicator } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { InfoTip } from "@/components/layout/shared/info-tip";
import type { ModuleTone } from "@/components/layout/shared/module-tone";
import { ScoreRing } from "@/components/layout/shared/score-ring";
import { FixButton, SectionUnavailable, StateBadge } from "@/components/gbp/gbp-ui";
import { GoogleLink } from "@/components/gbp/gbp-profile";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCanEdit } from "@/hooks/use-access";
import { axisProps, gridProps, MUTED_SERIES, seriesColor, tooltipProps } from "@/lib/chart-theme";
import { needsReplyPath } from "@/lib/dashboard/replies";
import { formatDate, formatShortDate } from "@/lib/datetime";
import {
  checkFix,
  GOOGLE_PROFILE_EDIT_URL,
  PILLAR_DESCRIPTION,
  PILLAR_LABEL,
  STATE_LABEL,
  STATE_ORDER,
  STATE_TONE,
  type FixContext,
} from "@/lib/gbp/gbp-labels";
import { GRADE_WORD } from "@/lib/health-tone";
import { locationPath } from "@/lib/mypageseo/section-links";
import { formatRunDate } from "@/lib/rankings/format";
import { useReviewsSummary } from "@/lib/reviews/use-reviews";
import { cn } from "@/lib/utils";

const PILLAR_ORDER: GbpPillarId[] = ["completeness", "activity", "reviews", "performance"];

/** Points a check would still add. */
const gain = (check: GbpCheck) => Math.max(0, check.max - check.points);

/** The last two scores on the current formula (version 2), oldest first, for "since last time". */
function lastTwoScores(history: ScoreHistoryEntry[]) {
  const current = [...history]
    .filter((entry) => (entry.version ?? 1) >= 2 && entry.gbp_score !== null)
    .sort((a, b) => a.generated_at.localeCompare(b.generated_at));
  return current.slice(-2);
}

/* -------------------------------------------------------------------------- */
/* Score                                                                       */
/* -------------------------------------------------------------------------- */

const COUNT_ICON: Record<"fail" | "partial" | "pass", { icon: LucideIcon; color: string }> = {
  fail: { icon: XCircle, color: "text-critical" },
  partial: { icon: AlertCircle, color: "text-warning" },
  pass: { icon: CheckCircle2, color: "text-success" },
};

/** One line of the check tally; a zero is good news or nothing to say, so it stays grey (never red). */
function CountRow({ state, count }: { state: "fail" | "partial" | "pass"; count: number }) {
  const { icon: Icon, color } = COUNT_ICON[state];
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon aria-hidden className={cn("size-4", count === 0 ? "text-muted-foreground" : color)} />
        {STATE_LABEL[state]}
      </dt>
      <dd className="text-sm font-semibold tabular-nums text-foreground">{count}</dd>
    </div>
  );
}

/** The profile score as a ring with its grade, the change since the last report and the check counts. */
export function ScoreCard({ score, history, v4Enabled }: { score: GbpScore; history: ScoreHistoryEntry[]; v4Enabled: boolean }) {
  const excluded = score.excluded_pillars.map((id) => PILLAR_LABEL[id] ?? id);
  const [previous, latest] = lastTwoScores(history);
  const delta = previous && latest && previous.gbp_score !== null && latest.gbp_score !== null ? latest.gbp_score - previous.gbp_score : null;

  return (
    <section aria-labelledby="gbp-score-title" className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 id="gbp-score-title" className="text-[15px] font-semibold text-foreground">
          Profile score
        </h2>
        <InfoTip label="About the profile score">
          A 0–100 score from the profile's own data: completeness (25), activity (20), reviews (25) and Google's performance numbers (30). Grades: A 85+, B
          70+, C 55+, D 40+, F below. Ranking positions are not part of it.
        </InfoTip>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <ScoreRing value={score.score} size="lg" label="Profile score" />
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Grade</p>
          <p className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
            {score.grade} <span className="text-base font-medium text-muted-foreground">{GRADE_WORD[score.grade] ?? ""}</span>
          </p>
          {delta !== null && previous ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <TrendIndicator
                variant="chip"
                direction={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}
                value={delta === 0 ? "No change" : `${Math.abs(delta)} pt${Math.abs(delta) === 1 ? "" : "s"}`}
              />
              since {formatShortDate(previous.generated_at)}
            </p>
          ) : null}
        </div>
      </div>
      {/* Pushes the tally to the bottom when the card stretches to the fixes list next to it. */}
      <div aria-hidden className="min-h-6 flex-1" />
      <dl aria-label="Checks" className="divide-y divide-border border-t border-border pt-1.5">
        <CountRow state="fail" count={score.counts.fail} />
        <CountRow state="partial" count={score.counts.partial} />
        <CountRow state="pass" count={score.counts.pass} />
      </dl>
      {score.partial ? (
        <p className="mt-4 rounded-lg bg-info-surface px-3 py-2 text-xs text-foreground">
          Partial score: {excluded.join(" and ")} {excluded.length === 1 ? "isn't" : "aren't"} scored yet
          {!v4Enabled ? " (reviews, photos and posts need a Google approval that is still pending)" : ""}, so the rest is scaled to 100.
        </p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Improve first                                                               */
/* -------------------------------------------------------------------------- */

/** The checks that would add the most points, each with its fix. */
export function TopFixes({ fixes, ctx, onSelect }: { fixes: GbpCheck[]; ctx: FixContext; onSelect: (check: GbpCheck) => void }) {
  const total = fixes.reduce((sum, fix) => sum + gain(fix), 0);
  return (
    <Panel
      title="Improve first"
      description={fixes.length ? `${fixes.length} fix${fixes.length === 1 ? "" : "es"} worth up to ${total} points, biggest first.` : "The fixes worth the most points."}
      icon={Lightbulb}
      tone="gbp"
    >
      {fixes.length === 0 ? (
        <EmptyState
          variant="all-done"
          compact
          title="Nothing to fix right now"
          description="Every scored check earns full points. Keep posting, adding photos and replying to reviews to stay there."
          className="border-0"
        />
      ) : (
        <ol className="-m-4 divide-y divide-border">
          {fixes.map((fix, index) => {
            const action = checkFix(fix, ctx);
            return (
              <li key={fix.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-chart-2/12 text-xs font-semibold text-foreground ring-1 ring-inset ring-chart-2/30">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onSelect(fix)}
                  className="group min-w-0 flex-[1_1_14rem] rounded-md text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary">{fix.label}</span>
                    <StatusBadge tone="brand" size="sm">
                      +{gain(fix)} point{gain(fix) === 1 ? "" : "s"}
                    </StatusBadge>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{fix.fix_hint ?? fix.detail}</span>
                </button>
                {action ? <FixButton fix={action} className="ml-10 sm:ml-0" /> : null}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Parts of the score                                                          */
/* -------------------------------------------------------------------------- */

export function Pillars({ score }: { score: GbpScore }) {
  const pillars = PILLAR_ORDER.map((id) => score.pillars.find((pillar) => pillar.id === id)).filter((pillar) => pillar !== undefined);
  return (
    <section aria-label="Parts of the score" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {pillars.map((pillar) => {
        // The ring wears its badge's colour (the part's checks: pass, partial, fail), so one card
        // never shows two statuses; a part with no data keeps the plain track.
        const status = STATE_TONE[pillar.state];
        return (
          <div key={pillar.id} className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
            <ScoreRing
              value={pillar.available ? pillar.score : null}
              max={pillar.weight}
              size="md"
              label={PILLAR_LABEL[pillar.id] ?? pillar.id}
              {...(status === "neutral" ? {} : { status })}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
                {PILLAR_LABEL[pillar.id] ?? pillar.id}
                <InfoTip label={`About ${PILLAR_LABEL[pillar.id] ?? "this part"}`}>{PILLAR_DESCRIPTION[pillar.id]}</InfoTip>
              </p>
              {pillar.available && pillar.score !== null ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {pillar.score} of {pillar.weight} points
                  </p>
                  <div className="mt-2">
                    <StateBadge state={pillar.state} size="sm" />
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No data for this part yet, so it's left out of the score.</p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* All checks, grouped by severity                                             */
/* -------------------------------------------------------------------------- */

function CheckRow({ check, ctx, onSelect }: { check: GbpCheck; ctx: FixContext; onSelect: (check: GbpCheck) => void }) {
  const action = checkFix(check, ctx);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <button
        type="button"
        onClick={() => onSelect(check)}
        className="group flex min-w-0 flex-[1_1_16rem] items-center gap-3 rounded-md text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{check.label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {PILLAR_LABEL[check.pillar] ?? check.pillar} · {check.detail}
          </span>
        </span>
        {check.status === "scored" ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">{check.points}</span>/{check.max} pts
          </span>
        ) : null}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
      </button>
      {action ? <FixButton fix={action} /> : null}
    </li>
  );
}

function CheckGroup({
  state,
  checks,
  ctx,
  onSelect,
  collapsible,
}: {
  state: CheckState;
  checks: GbpCheck[];
  ctx: FixContext;
  onSelect: (check: GbpCheck) => void;
  collapsible: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const heading = (
    <span className="flex items-center gap-2">
      <StateBadge state={state} />
      <span className="text-sm text-muted-foreground">
        {checks.length} check{checks.length === 1 ? "" : "s"}
      </span>
    </span>
  );
  const list = (
    <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
      {checks.map((check) => (
        <CheckRow key={check.id} check={check} ctx={ctx} onSelect={onSelect} />
      ))}
    </ul>
  );
  if (!collapsible) {
    return (
      <section aria-label={`${STATE_LABEL[state]}: ${checks.length}`}>
        <h3>{heading}</h3>
        {list}
      </section>
    );
  }
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section aria-label={`${STATE_LABEL[state]}: ${checks.length}`}>
        <h3>
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            {heading}
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              {open ? "Hide" : "Show"}
              <ChevronDown aria-hidden className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
            </span>
          </CollapsibleTrigger>
        </h3>
        <CollapsibleContent>{list}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/** Every check: what needs work first, then what could be better; passing checks fold away. */
export function ChecksBySeverity({ score, ctx, onSelect }: { score: GbpScore; ctx: FixContext; onSelect: (check: GbpCheck) => void }) {
  const groups = STATE_ORDER.map((state) => ({
    state,
    checks: score.checks.filter((check) => check.state === state).sort((a, b) => gain(b) - gain(a) || a.label.localeCompare(b.label)),
  })).filter((group) => group.checks.length > 0);
  const open = groups.filter((group) => group.state === "fail" || group.state === "partial");

  return (
    <Panel title="All checks" description="What needs work comes first. Select a check to see what was found and how to improve it.">
      <div className="space-y-5">
        {open.length === 0 ? (
          <EmptyState
            variant="all-done"
            compact
            title="Every check is in good shape"
            description="Nothing needs work right now. Passing checks are listed below."
            className="border-0 py-4"
          />
        ) : null}
        {groups.map((group) => (
          <CheckGroup
            key={group.state}
            state={group.state}
            checks={group.checks}
            ctx={ctx}
            onSelect={onSelect}
            collapsible={group.state === "pass" || group.state === "not_available"}
          />
        ))}
      </div>
    </Panel>
  );
}

/** The detail of one check: what was found, why it matters, how to improve it, and its fix. */
export function CheckSheet({ check, ctx, onClose }: { check: GbpCheck | null; ctx: FixContext; onClose: () => void }) {
  const action = check ? checkFix(check, ctx) : null;
  return (
    <Sheet open={check !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        {check ? (
          <>
            <SheetHeader className="pr-8 text-left">
              <SheetTitle>{check.label}</SheetTitle>
              <SheetDescription>{PILLAR_LABEL[check.pillar] ?? check.pillar}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap items-center gap-3">
              <StateBadge state={check.state} />
              {check.status === "scored" ? (
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">{check.points}</span> of {check.max} points
                  {gain(check) > 0 ? ` · +${gain(check)} possible` : ""}
                </span>
              ) : null}
            </div>
            <div className="space-y-5">
              <Detail label="What we found" text={check.detail} />
              {check.why_it_matters ? <Detail label="Why it matters" text={check.why_it_matters} /> : null}
              <Detail
                label="How to improve"
                text={check.fix_hint ?? (check.state === "pass" ? "Nothing to do: this check earns full points." : "No specific action available.")}
              />
            </div>
            {action ? (
              <SheetFooter className="mt-auto border-t border-border pt-4 sm:justify-start">
                <FixButton fix={action} size="default" />
              </SheetFooter>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      <p className="mt-1 text-sm leading-6 text-foreground">{text}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Reviews, photos, posts                                                      */
/* -------------------------------------------------------------------------- */

function Stat({ label, value, emphasis }: { label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm tabular-nums text-foreground", emphasis && "font-semibold")}>{value}</dd>
    </div>
  );
}

function replyTime(hours: number | null) {
  if (hours == null) return "—";
  return hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} days`;
}

/** A summary card whose actions line up at the bottom, whatever the height of its neighbours. */
function SummaryCard({
  title,
  icon,
  tone,
  children,
  footer,
}: {
  title: string;
  icon: LucideIcon;
  tone: ModuleTone;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col rounded-xl border border-border bg-card shadow-card">
      {/* Panel's header: the chip sits on the title line (centred on its 24px), even if the title wraps. */}
      <div className="flex items-start gap-3 border-b border-border px-4 py-3.5">
        <IconChip icon={icon} tone={tone} size="sm" className="-mt-0.5" />
        <h2 id={id} className="text-[15px] font-semibold leading-6 text-foreground">
          {title}
        </h2>
      </div>
      <div className="flex-1 p-4">{children}</div>
      {footer ? <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">{footer}</div> : null}
    </section>
  );
}

export function ReviewsSummary({ report }: { report: GbpReport }) {
  const reviews = report.reviews;
  const locationId = report.location_id;
  const canEdit = useCanEdit();
  // The report keeps only the newest unanswered reviews (at most 10), so the count comes from the
  // reviews summary: the same "need a reply" number as the location's Overview and Reviews pages.
  const summary = useReviewsSummary(locationId);
  const needReply = summary.data?.stats?.unreplied ?? null;
  const distributionTotal = reviews.available ? Object.values(reviews.distribution).reduce((sum, value) => sum + value, 0) : 0;
  // Until the count arrives, the report's sample can still tell whether any review waits (not how many).
  const anyToAnswer = needReply !== null ? needReply > 0 : reviews.available && reviews.unreplied.length > 0;

  return (
    <SummaryCard
      title="Reviews"
      icon={MessageSquareHeart}
      tone="reputation"
      footer={
        <>
          {/* The page's one filled action is the PDF report: AI keeps the soft outline the checks use. */}
          {reviews.available && anyToAnswer && canEdit ? (
            <Button asChild size="sm" variant="outline">
              <Link to={locationPath(locationId, "ai/replies")}>
                <Sparkles aria-hidden className="text-ai" /> Draft replies with AI
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link to={anyToAnswer ? needsReplyPath(locationId) : locationPath(locationId, "reputation")}>
              Open reviews <ArrowRight aria-hidden />
            </Link>
          </Button>
        </>
      }
    >
      {!reviews.available ? (
        <SectionUnavailable section={reviews} compact />
      ) : (
        <div className="space-y-4">
          <p className="flex items-center gap-2">
            <Star aria-hidden className="size-6 fill-warning-bright text-warning" />
            <span className="text-3xl font-semibold tracking-tight text-foreground">{reviews.average_rating?.toFixed(1) ?? "—"}</span>
            <span className="text-sm text-muted-foreground">{reviews.total?.toLocaleString() ?? "—"} reviews</span>
          </p>
          <div
            className="space-y-1"
            role="img"
            aria-label={`Ratings: ${(["5", "4", "3", "2", "1"] as const).map((stars) => `${stars} stars ${reviews.distribution[stars] ?? 0}`).join(", ")}`}
          >
            {(["5", "4", "3", "2", "1"] as const).map((stars) => {
              const count = reviews.distribution[stars] ?? 0;
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums text-muted-foreground">{stars}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-chart-7" style={{ width: `${distributionTotal ? (count / distributionTotal) * 100 : 0}%` }} />
                  </div>
                  <span className="w-8 text-right tabular-nums text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
          <dl className="divide-y divide-border border-t border-border">
            <Stat label="New in 30 days" value={reviews.new_30d ?? "—"} />
            <Stat label="Answered (90 days)" value={reviews.reply_rate_90d == null ? "—" : `${Math.round(reviews.reply_rate_90d * 100)}%`} />
            <Stat label="Typical reply time" value={replyTime(reviews.median_reply_hours)} />
            <Stat
              label="Need a reply"
              emphasis
              value={
                needReply === null ? (
                  "—"
                ) : needReply > 0 ? (
                  <StatusBadge tone="warning" size="sm">
                    {needReply.toLocaleString()}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="success" size="sm">
                    None
                  </StatusBadge>
                )
              }
            />
          </dl>
        </div>
      )}
    </SummaryCard>
  );
}

export function PhotosSummary({ report }: { report: GbpReport }) {
  const media = report.media;
  const mapsUri = report.profile.available ? report.profile.maps_uri : null;
  return (
    <SummaryCard title="Photos" icon={Camera} tone="gbp" footer={<GoogleLink href={mapsUri ?? GOOGLE_PROFILE_EDIT_URL}>Add photos on Google</GoogleLink>}>
      {!media.available ? (
        <SectionUnavailable section={media} compact />
      ) : (
        <>
          <dl className="divide-y divide-border">
            <Stat label="Your photos" value={media.owner_count.toLocaleString()} emphasis />
            <Stat label="Customer photos" value={media.customer_count.toLocaleString()} />
            <Stat label="Your latest upload" value={media.latest_owner_upload ? formatRunDate(media.latest_owner_upload) : "—"} />
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">A few fresh photos every month keep the profile looking active.</p>
        </>
      )}
    </SummaryCard>
  );
}

export function PostsSummary({ report }: { report: GbpReport }) {
  const posts = report.posts;
  const locationId = report.location_id;
  const canEdit = useCanEdit();
  return (
    <SummaryCard
      title="Posts"
      icon={PenLine}
      tone="posts"
      footer={
        <>
          {canEdit ? (
            <Button asChild size="sm" variant="outline">
              <Link to={locationPath(locationId, "gbp/posts")}>
                Write a post <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <Link to={locationPath(locationId, "ai/posts")}>
              <Sparkles aria-hidden className="text-ai" /> AI Posts
            </Link>
          </Button>
        </>
      }
    >
      {!posts.available ? (
        <SectionUnavailable section={posts} compact />
      ) : (
        <>
          <dl className="divide-y divide-border">
            <Stat label="Last 30 days" value={posts.last_30_days} emphasis />
            <Stat label="Last 90 days" value={posts.last_90_days} />
            <Stat label="Latest post" value={posts.last_post_at ? formatRunDate(posts.last_post_at) : "—"} />
            <Stat label="All time" value={posts.total} />
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">A post a week keeps offers and news in front of searchers.</p>
        </>
      )}
    </SummaryCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Score history                                                               */
/* -------------------------------------------------------------------------- */

type HistoryRow = { at: string; label: string; v1: number | null; v2: number | null; grade: string | null };

function HistoryTooltip({ active, payload }: { active?: boolean | undefined; payload?: readonly { payload?: unknown }[] | undefined }) {
  const row = payload?.[0]?.payload as HistoryRow | undefined;
  if (!active || !row) return null;
  const value = row.v2 ?? row.v1;
  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-xs shadow-raised">
      <p className="font-medium text-muted-foreground">{formatDate(row.at)}</p>
      <p className="mt-1 flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: row.v2 !== null ? seriesColor(0) : MUTED_SERIES }} />
        <span className="font-semibold tabular-nums text-foreground">{value ?? "—"}</span>
        <span className="text-muted-foreground">
          {row.v2 !== null ? "Profile score" : "Old formula"}
          {row.grade ? ` · grade ${row.grade}` : ""}
        </span>
      </p>
    </div>
  );
}

/** The profile score over time; version 1 scores included ranking data, so they aren't compared with version 2. */
export function ScoreHistory({ history }: { history: ScoreHistoryEntry[] }) {
  const rows: HistoryRow[] = [...history]
    .sort((a, b) => a.generated_at.localeCompare(b.generated_at))
    .filter((entry) => entry.gbp_score !== null)
    .map((entry) => ({
      at: entry.generated_at,
      label: formatShortDate(entry.generated_at),
      // Separate series per formula version so no line connects across the change.
      v1: (entry.version ?? 1) === 1 ? entry.gbp_score : null,
      v2: (entry.version ?? 1) >= 2 ? entry.gbp_score : null,
      grade: entry.grade,
    }));
  const hasOld = rows.some((row) => row.v1 !== null);
  const changeAt = hasOld ? rows.find((row) => row.v2 !== null) : undefined;

  if (rows.length < 2) {
    return (
      <Panel title="Score history" icon={History} tone="settings">
        <EmptyState
          variant="first-use"
          compact
          icon={History}
          tone="gbp"
          title="Your score history starts here"
          description="Each new report adds a point. Check back after the next monthly refresh to see the trend."
          className="border-0"
        />
      </Panel>
    );
  }
  return (
    <Panel
      title="Score history"
      description={changeAt ? "The score stopped including ranking positions on the date marked; earlier scores aren't comparable." : "Your profile score each time the report was made."}
      icon={History}
      tone="settings"
    >
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: seriesColor(0) }} />
          <span className="text-muted-foreground">Profile score</span>
        </li>
        {hasOld ? (
          <li className="flex items-center gap-2">
            <span aria-hidden className="w-3.5 border-t-2 border-dashed" style={{ borderColor: MUTED_SERIES }} />
            <span className="text-muted-foreground">Old formula (included rankings)</span>
          </li>
        ) : null}
      </ul>
      <div
        className="h-56"
        role="img"
        aria-label={`Profile score history: ${rows.map((row) => `${row.label} ${row.v2 ?? row.v1}`).join(", ")}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} minTickGap={24} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={36} {...axisProps} />
            <Tooltip cursor={tooltipProps.cursor} content={(props) => <HistoryTooltip active={props.active} payload={props.payload} />} />
            {changeAt ? (
              <ReferenceLine
                x={changeAt.label}
                stroke="var(--color-border-strong)"
                strokeDasharray="4 4"
                label={{ value: "New formula", fontSize: 12, fill: "var(--color-muted-foreground)", position: "insideTopLeft" }}
              />
            ) : null}
            <Line type="monotone" dataKey="v1" name="Old formula" stroke={MUTED_SERIES} strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3, fill: MUTED_SERIES, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="v2"
              name="Profile score"
              stroke={seriesColor(0)}
              strokeWidth={2.5}
              dot={{ r: 4, fill: seriesColor(0), stroke: "var(--color-card)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--color-card)", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
